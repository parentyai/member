'use strict';

const assert = require('assert');
const { beforeEach, afterEach, test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const opsSnapshotsRepo = require('../../src/repos/firestore/opsSnapshotsRepo');
const { getNotificationOperationalSummary } = require('../../src/usecases/admin/getNotificationOperationalSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase330: notification summary returns snapshot data in require mode', async () => {
  await opsSnapshotsRepo.saveSnapshot({
    snapshotType: 'notification_operational_summary',
    snapshotKey: 'latest',
    data: {
      items: [
        {
          notificationId: 'N_PHASE330',
          title: 'from snapshot',
          sentAt: '2026-01-01T00:00:00.000Z',
          openCount: 2,
          clickCount: 1,
          lastReactionAt: '2026-01-02T00:00:00.000Z'
        }
      ]
    }
  });

  const items = await getNotificationOperationalSummary({ snapshotMode: 'require' });
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].notificationId, 'N_PHASE330');
  assert.strictEqual(items[0].openCount, 2);
});

test('phase330: notification summary require mode returns empty when snapshot missing', async () => {
  const items = await getNotificationOperationalSummary({ snapshotMode: 'require' });
  assert.deepStrictEqual(items, []);
});
