'use strict';

const assert = require('node:assert/strict');
const { beforeEach, afterEach, test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { createNotification } = require('../../src/usecases/notifications/createNotification');
const { sendNotification } = require('../../src/usecases/notifications/sendNotification');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase745: sendNotification collects fatigue warnings in warn-only mode', async () => {
  const previous = process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
  process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = '1';
  try {
    const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
    const created = await createNotification({
      title: 'Title',
      body: 'Body',
      ctaText: 'Go',
      linkRegistryId: link.id,
      scenarioKey: 'A',
      stepKey: '3mo',
      notificationCategory: 'SEQUENCE_GUIDANCE',
      target: { all: true }
    });
    await usersRepo.createUser('U745_SN', { scenarioKey: 'A', stepKey: '3mo' });

    const result = await sendNotification({
      notificationId: created.id,
      sentAt: '2026-03-07T11:00:00.000Z',
      killSwitch: false,
      pushFn: async () => ({ status: 200 }),
      computeNotificationFatigueWarningFn: async () => ({
        lineUserId: 'U745_SN',
        notificationCategory: 'SEQUENCE_GUIDANCE',
        sinceAt: '2026-03-07T00:00:00.000Z',
        deliveredToday: 2,
        projectedDeliveredToday: 3,
        threshold: 2,
        warn: true,
        reason: 'daily_notification_volume_high'
      })
    });

    assert.equal(result.deliveredCount, 1);
    assert.equal(result.fatigueWarnEnabled, true);
    assert.equal(result.fatigueWarningCount, 1);
    assert.equal(Array.isArray(result.fatigueWarnings), true);
    assert.equal(result.fatigueWarnings.length, 1);
    assert.equal(result.fatigueWarnings[0].lineUserId, 'U745_SN');
    assert.equal(result.fatigueWarnings[0].reason, 'daily_notification_volume_high');
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
    else process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = previous;
  }
});

test('phase745: fatigue warning failures remain best-effort and do not block send', async () => {
  const previous = process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
  process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = '1';
  try {
    const link = await linkRegistryRepo.createLink({ title: 't2', url: 'https://example.com/2' });
    const created = await createNotification({
      title: 'Title 2',
      body: 'Body 2',
      ctaText: 'Go 2',
      linkRegistryId: link.id,
      scenarioKey: 'A',
      stepKey: '3mo',
      notificationCategory: 'SEQUENCE_GUIDANCE',
      target: { all: true }
    });
    await usersRepo.createUser('U745_SN_2', { scenarioKey: 'A', stepKey: '3mo' });

    const result = await sendNotification({
      notificationId: created.id,
      sentAt: '2026-03-07T11:10:00.000Z',
      killSwitch: false,
      pushFn: async () => ({ status: 200 }),
      computeNotificationFatigueWarningFn: async () => {
        throw new Error('fatigue backend unavailable');
      }
    });

    assert.equal(result.deliveredCount, 1);
    assert.equal(result.fatigueWarnEnabled, true);
    assert.equal(result.fatigueWarningCount, 0);
    assert.equal(result.fatigueWarnings.length, 0);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
    else process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = previous;
  }
});
