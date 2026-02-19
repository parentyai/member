'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const { createNotification } = require('../../src/usecases/notifications/createNotification');

test('phase272: createNotification stores notificationType and notificationMeta add-only fields', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const link = await linkRegistryRepo.createLink({
    title: 'Phase272 link',
    url: 'https://example.com/phase272',
    lastHealth: { state: 'OK' }
  });

  const created = await createNotification({
    title: 'Type test',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: 'week',
    target: { limit: 50 },
    notificationType: 'VENDOR',
    notificationMeta: { vendorId: 'v-001', extra: { ok: true, ng: { deep: true } } }
  });

  const row = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(row.notificationType, 'VENDOR');
  assert.ok(row.notificationMeta);
  assert.strictEqual(row.notificationMeta.vendorId, 'v-001');
  assert.deepStrictEqual(row.notificationMeta.extra, { ok: true });
});
