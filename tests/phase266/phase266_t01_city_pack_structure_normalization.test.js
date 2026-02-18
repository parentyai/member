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
const cityPacksRepo = require('../../src/repos/firestore/cityPacksRepo');

test('phase266: city pack create normalizes targetingRules and slots', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  try {
    const created = await cityPacksRepo.createCityPack({
      id: 'cp_structure_266',
      name: 'City Pack Structure',
      sourceRefs: ['sr_1'],
      targetingRules: [
        { field: 'regionKey', op: 'EQ', value: 'TX::austin', effect: 'INCLUDE' },
        { field: 'regionKey', op: 'EQ', value: 'TX::austin', effect: 'INCLUDE' },
        { field: ' ', op: 'eq', value: 'ignore_me' }
      ],
      slots: [
        { slotId: 'core', status: 'ACTIVE', order: 2 },
        { slotId: 'core', status: 'inactive', order: 1 },
        { slotId: 'notice', status: 'inactive', order: 3 }
      ]
    });
    const pack = await cityPacksRepo.getCityPack(created.id);
    assert.ok(pack);
    assert.deepStrictEqual(pack.targetingRules, [
      { field: 'regionKey', op: 'eq', value: 'TX::austin', effect: 'include' }
    ]);
    assert.strictEqual(Array.isArray(pack.slots), true);
    assert.strictEqual(pack.slots.length, 2);
    assert.strictEqual(pack.slots[0].slotId, 'core');
    assert.strictEqual(pack.slots[0].status, 'active');
    assert.strictEqual(pack.slots[1].slotId, 'notice');
    assert.strictEqual(pack.slots[1].status, 'inactive');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
