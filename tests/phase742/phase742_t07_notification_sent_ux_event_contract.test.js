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

const usersRepo = require('../../src/repos/firestore/usersRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const eventsRepo = require('../../src/repos/firestore/eventsRepo');
const { createNotification } = require('../../src/usecases/notifications/createNotification');
const { approveNotification } = require('../../src/usecases/adminOs/approveNotification');
const { planNotificationSend } = require('../../src/usecases/adminOs/planNotificationSend');
const { executeNotificationSend } = require('../../src/usecases/adminOs/executeNotificationSend');

const ORIGINAL_SECRET = process.env.OPS_CONFIRM_TOKEN_SECRET;

beforeEach(() => {
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'phase742-confirm-secret';
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
  if (ORIGINAL_SECRET === undefined) delete process.env.OPS_CONFIRM_TOKEN_SECRET;
  else process.env.OPS_CONFIRM_TOKEN_SECRET = ORIGINAL_SECRET;
});

test('phase742: execute notification appends ux_event notification_sent when flag is enabled', async () => {
  const prev = process.env.ENABLE_UXOS_EVENTS;
  process.env.ENABLE_UXOS_EVENTS = '1';
  try {
    const link = await linkRegistryRepo.createLink({ title: 't742', url: 'https://example.com/t742' });
    await usersRepo.createUser('U742', { scenarioKey: 'A', stepKey: 'week' });

    const created = await createNotification({
      title: 'Title742',
      body: 'Body742',
      ctaText: 'Go742',
      linkRegistryId: link.id,
      scenarioKey: 'A',
      stepKey: 'week',
      target: { limit: 10 },
      createdBy: 'phase742_tester'
    });
    await approveNotification({ notificationId: created.id, actor: 'phase742_tester' });

    const plan = await planNotificationSend({
      notificationId: created.id,
      actor: 'phase742_tester',
      traceId: 'trace742_exec',
      requestId: 'req742_exec_plan'
    }, { now: new Date('2026-03-07T00:00:00.000Z') });

    const exec = await executeNotificationSend({
      notificationId: created.id,
      planHash: plan.planHash,
      confirmToken: plan.confirmToken,
      actor: 'phase742_tester',
      traceId: 'trace742_exec',
      requestId: 'req742_exec_send'
    }, {
      now: new Date('2026-03-07T00:00:30.000Z'),
      getKillSwitch: async () => false,
      pushFn: async () => ({ status: 200 })
    });

    assert.equal(exec.ok, true);
    const events = await eventsRepo.listEventsByUser('U742', 20);
    const uxEvent = events.find((row) => row && row.type === 'ux_event' && row.uxEventType === 'notification_sent');
    assert.ok(uxEvent, 'ux_event notification_sent must be appended');
    assert.equal(uxEvent.ref.notificationId, created.id);
  } finally {
    if (prev === undefined) delete process.env.ENABLE_UXOS_EVENTS;
    else process.env.ENABLE_UXOS_EVENTS = prev;
  }
});
