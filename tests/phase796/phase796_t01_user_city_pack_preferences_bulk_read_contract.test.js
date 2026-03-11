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
const userCityPackPreferencesRepo = require('../../src/repos/firestore/userCityPackPreferencesRepo');

test('phase796: listUserCityPackPreferencesByLineUserIds dedupes ids and returns normalized rows', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await userCityPackPreferencesRepo.upsertUserCityPackPreference('U_PHASE796_A', {
      modulesSubscribed: ['schools', 'schools', 'driving', 'unknown']
    }, 'phase796_test');
    await userCityPackPreferencesRepo.upsertUserCityPackPreference('U_PHASE796_B', {
      modulesSubscribed: ['housing']
    }, 'phase796_test');

    const rows = await userCityPackPreferencesRepo.listUserCityPackPreferencesByLineUserIds([
      'U_PHASE796_A',
      ' U_PHASE796_B ',
      'U_PHASE796_A',
      '',
      '   ',
      null
    ]);

    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].lineUserId, 'U_PHASE796_A');
    assert.deepStrictEqual(rows[0].modulesSubscribed, ['schools', 'driving']);
    assert.strictEqual(rows[1].lineUserId, 'U_PHASE796_B');
    assert.deepStrictEqual(rows[1].modulesSubscribed, ['housing']);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase796: listUserCityPackPreferencesByLineUserIds uses db.getAll path when available', async () => {
  const db = createDbStub();
  let getAllCalls = 0;
  db.getAll = async (...refs) => {
    getAllCalls += 1;
    return Promise.all(refs.map((ref) => ref.get()));
  };
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await userCityPackPreferencesRepo.upsertUserCityPackPreference('U_PHASE796_GETALL', {
      modulesSubscribed: ['utilities']
    }, 'phase796_test');

    const rows = await userCityPackPreferencesRepo.listUserCityPackPreferencesByLineUserIds([
      'U_PHASE796_GETALL',
      'U_PHASE796_MISSING'
    ]);

    assert.ok(getAllCalls >= 1);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].lineUserId, 'U_PHASE796_GETALL');
    assert.deepStrictEqual(rows[0].modulesSubscribed, ['utilities']);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
