'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('./firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const { createNotification } = require('../../src/usecases/notifications/createNotification');
const { listNotifications } = require('../../src/usecases/notifications/listNotifications');
const { sendNotification } = require('../../src/usecases/notifications/sendNotification');

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

test('createNotification: stores draft notification', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  const result = await createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    target: { all: true }
  });

  assert.ok(result.id);
  const stored = await notificationsRepo.getNotification(result.id);
  assert.ok(stored);
  assert.strictEqual(stored.status, 'draft');
  assert.strictEqual(stored.scenarioKey, 'A');
  assert.strictEqual(stored.stepKey, '3mo');
});

test('createNotification: normalizes legacy scenario input into canonical scenarioKey write', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  const result = await createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenario: 'A',
    stepKey: '3mo',
    target: { all: true }
  });

  const stored = await notificationsRepo.getNotification(result.id);
  assert.strictEqual(stored.scenarioKey, 'A');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(stored, 'scenario'), false);
});

test('createNotification: keeps explicit scenarioKey when legacy scenario is also provided', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  const result = await createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'B',
    scenario: 'A',
    stepKey: '3mo',
    target: { all: true }
  });

  const stored = await notificationsRepo.getNotification(result.id);
  assert.strictEqual(stored.scenarioKey, 'B');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(stored, 'scenario'), false);
});

test('createNotification: stores normalized notificationCategory', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  const result = await createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    notificationCategory: 'sequence_guidance',
    target: { all: true }
  });
  const stored = await notificationsRepo.getNotification(result.id);
  assert.strictEqual(stored.notificationCategory, 'SEQUENCE_GUIDANCE');
});

test('sendNotification: creates deliveries for matching users', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  const created = await createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    target: { all: true }
  });

  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo' });
  await usersRepo.createUser('U2', { scenarioKey: 'A', stepKey: '3mo' });

  const sentTo = [];
  const result = await sendNotification({
    notificationId: created.id,
    sentAt: 'NOW',
    killSwitch: false,
    pushFn: async (lineUserId) => {
      sentTo.push(lineUserId);
      return { status: 200 };
    }
  });

  assert.strictEqual(result.deliveredCount, 2);
  assert.strictEqual(sentTo.length, 2);

  const deliveries = db._state.collections.notification_deliveries;
  assert.strictEqual(Object.keys(deliveries.docs).length, 2);

  const updated = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(updated.status, 'sent');
  assert.strictEqual(updated.sentAt, 'NOW');
});

test('listNotifications: filters by scenarioKey', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  await createNotification({
    title: 'A',
    body: 'Body A',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    target: { all: true }
  });
  await createNotification({
    title: 'C',
    body: 'Body C',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'C',
    stepKey: '3mo',
    target: { all: true }
  });

  const results = await listNotifications({ scenarioKey: 'A' });
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].scenarioKey, 'A');
});

test('createNotification: stores secondaryCtas add-only when multi CTA flag is enabled', async () => {
  const prevMulti = process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1;
  process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1 = '1';
  try {
    const primary = await linkRegistryRepo.createLink({ title: 'p', url: 'https://example.com/p' });
    const secondary1 = await linkRegistryRepo.createLink({ title: 's1', url: 'https://example.com/s1' });
    const secondary2 = await linkRegistryRepo.createLink({ title: 's2', url: 'https://example.com/s2' });
    const result = await createNotification({
      title: 'Title',
      body: 'Body',
      ctaText: 'Primary',
      linkRegistryId: primary.id,
      secondaryCtas: [
        { ctaText: 'Secondary1', linkRegistryId: secondary1.id },
        { ctaText: 'Secondary2', linkRegistryId: secondary2.id }
      ],
      scenarioKey: 'A',
      stepKey: '3mo',
      target: { all: true }
    });
    const stored = await notificationsRepo.getNotification(result.id);
    assert.ok(Array.isArray(stored.secondaryCtas));
    assert.strictEqual(stored.secondaryCtas.length, 2);
    assert.strictEqual(stored.secondaryCtas[0].ctaText, 'Secondary1');
    assert.strictEqual(stored.secondaryCtas[1].linkRegistryId, secondary2.id);
  } finally {
    if (prevMulti === undefined) delete process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1;
    else process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1 = prevMulti;
  }
});

test('createNotification: rejects secondaryCtas when multi CTA flag is disabled', async () => {
  const prevMulti = process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1;
  delete process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1;
  try {
    const primary = await linkRegistryRepo.createLink({ title: 'p', url: 'https://example.com/p' });
    const secondary1 = await linkRegistryRepo.createLink({ title: 's1', url: 'https://example.com/s1' });
    await assert.rejects(
      () => createNotification({
        title: 'Title',
        body: 'Body',
        ctaText: 'Primary',
        linkRegistryId: primary.id,
        secondaryCtas: [{ ctaText: 'Secondary1', linkRegistryId: secondary1.id }],
        scenarioKey: 'A',
        stepKey: '3mo',
        target: { all: true }
      }),
      /CTA must be exactly 1/
    );
  } finally {
    if (prevMulti === undefined) delete process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1;
    else process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1 = prevMulti;
  }
});

test('sendNotification: uses template buttons for 3 CTAs when flags are enabled', async () => {
  const prevMulti = process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1;
  const prevButtons = process.env.ENABLE_LINE_CTA_BUTTONS_V1;
  process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1 = '1';
  process.env.ENABLE_LINE_CTA_BUTTONS_V1 = '1';

  try {
    const primary = await linkRegistryRepo.createLink({ title: 'p', url: 'https://example.com/p' });
    const secondary1 = await linkRegistryRepo.createLink({ title: 's1', url: 'https://example.com/s1' });
    const secondary2 = await linkRegistryRepo.createLink({ title: 's2', url: 'https://example.com/s2' });

    const created = await createNotification({
      title: 'Title',
      body: 'Short body',
      ctaText: 'Primary',
      linkRegistryId: primary.id,
      secondaryCtas: [
        { ctaText: 'Secondary1', linkRegistryId: secondary1.id },
        { ctaText: 'Secondary2', linkRegistryId: secondary2.id }
      ],
      scenarioKey: 'A',
      stepKey: '3mo',
      target: { all: true }
    });

    await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo' });

    const sent = [];
    const result = await sendNotification({
      notificationId: created.id,
      sentAt: 'NOW',
      killSwitch: false,
      pushFn: async (_lineUserId, message) => {
        sent.push(message);
        return { status: 200 };
      }
    });

    assert.strictEqual(result.deliveredCount, 1);
    assert.strictEqual(result.ctaCount, 3);
    assert.strictEqual(result.lineMessageType, 'template_buttons');
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].type, 'template');
    assert.strictEqual(sent[0].template.type, 'buttons');
    assert.strictEqual(sent[0].template.actions.length, 3);
  } finally {
    if (prevMulti === undefined) delete process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1;
    else process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1 = prevMulti;
    if (prevButtons === undefined) delete process.env.ENABLE_LINE_CTA_BUTTONS_V1;
    else process.env.ENABLE_LINE_CTA_BUTTONS_V1 = prevButtons;
  }
});

test('sendNotification: falls back to text when template buttons constraints are not met', async () => {
  const prevMulti = process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1;
  const prevButtons = process.env.ENABLE_LINE_CTA_BUTTONS_V1;
  process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1 = '1';
  process.env.ENABLE_LINE_CTA_BUTTONS_V1 = '1';

  try {
    const primary = await linkRegistryRepo.createLink({ title: 'p', url: 'https://example.com/p' });
    const secondary1 = await linkRegistryRepo.createLink({ title: 's1', url: 'https://example.com/s1' });
    const created = await createNotification({
      title: 'Title',
      body: 'x'.repeat(161),
      ctaText: 'Primary',
      linkRegistryId: primary.id,
      secondaryCtas: [
        { ctaText: 'Secondary1', linkRegistryId: secondary1.id }
      ],
      scenarioKey: 'A',
      stepKey: '3mo',
      target: { all: true }
    });

    await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo' });

    const sent = [];
    const result = await sendNotification({
      notificationId: created.id,
      sentAt: 'NOW',
      killSwitch: false,
      pushFn: async (_lineUserId, message) => {
        sent.push(message);
        return { status: 200 };
      }
    });

    assert.strictEqual(result.deliveredCount, 1);
    assert.strictEqual(result.lineMessageType, 'text');
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].type, 'text');
  } finally {
    if (prevMulti === undefined) delete process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1;
    else process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1 = prevMulti;
    if (prevButtons === undefined) delete process.env.ENABLE_LINE_CTA_BUTTONS_V1;
    else process.env.ENABLE_LINE_CTA_BUTTONS_V1 = prevButtons;
  }
});
