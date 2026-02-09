'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');

async function seedBase(db) {
  await db.collection('users').doc('U1').set({
    createdAt: '2026-01-01T00:00:00.000Z',
    scenarioKey: 's1',
    stepKey: 'k1',
    memberNumber: 'M1'
  });
}

async function runSummaryWithDeliveries(deliveries) {
  const db = createDbStub();
  setDbForTest(db);
  await seedBase(db);

  for (const d of deliveries) {
    await db.collection('notification_deliveries').doc(d.id).set(d.data);
  }

  const { getUserStateSummary } = require('../../src/usecases/phase5/getUserStateSummary');
  const result = await getUserStateSummary({ lineUserId: 'U1' });
  clearDbForTest();
  return result;
}

test('phase127: lastReactionAt prefers clickAt over readAt', async () => {
  const result = await runSummaryWithDeliveries([{
    id: 'd1',
    data: {
      lineUserId: 'U1',
      clickAt: '2026-01-03T00:00:00.000Z',
      readAt: '2026-01-04T00:00:00.000Z'
    }
  }]);
  assert.strictEqual(result.lastReactionAt, '2026-01-03T00:00:00.000Z');
});

test('phase127: lastReactionAt falls back to readAt when clickAt missing', async () => {
  const result = await runSummaryWithDeliveries([{
    id: 'd1',
    data: {
      lineUserId: 'U1',
      readAt: '2026-01-04T00:00:00.000Z'
    }
  }]);
  assert.strictEqual(result.lastReactionAt, '2026-01-04T00:00:00.000Z');
});

test('phase127: lastReactionAt is null when both clickAt/readAt missing', async () => {
  const result = await runSummaryWithDeliveries([{
    id: 'd1',
    data: {
      lineUserId: 'U1'
    }
  }]);
  assert.strictEqual(result.lastReactionAt, null);
});

