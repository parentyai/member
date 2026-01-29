'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const { setChecklistItemDone } = require('../../src/usecases/checklists/setChecklistItemDone');
const { getChecklistWithStatus } = require('../../src/usecases/checklists/getChecklistWithStatus');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

async function seedChecklist(db) {
  await db.collection('users').doc('U1').set({ scenario: 'A' });
  await db.collection('checklists').doc('C1').set({
    scenario: 'A',
    step: '3mo',
    items: [{ itemId: 'item1', title: 't', linkRegistryId: 'L1', order: 1 }],
    createdAt: 't'
  });
}

test('toggle checklist done persists and reflects in GET', async () => {
  const db = createDbStub();
  setDbForTest(db);
  await seedChecklist(db);

  await setChecklistItemDone({ lineUserId: 'U1', itemKey: 'item1', done: true });

  const result = await getChecklistWithStatus({ lineUserId: 'U1', step: '3mo' });
  assert.strictEqual(result.items.length, 1);
  assert.ok(result.items[0].completedAt);
});

test('toggle checklist done false clears in GET', async () => {
  const db = createDbStub();
  setDbForTest(db);
  await seedChecklist(db);

  await setChecklistItemDone({ lineUserId: 'U1', itemKey: 'item1', done: true });
  await setChecklistItemDone({ lineUserId: 'U1', itemKey: 'item1', done: false });

  const result = await getChecklistWithStatus({ lineUserId: 'U1', step: '3mo' });
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].completedAt, null);
});
