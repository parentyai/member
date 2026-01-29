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

const { getMemberProfile } = require('../../src/usecases/users/getMemberProfile');
const { setMemberNumber } = require('../../src/usecases/users/setMemberNumber');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('getMemberProfile returns memberNumber', async () => {
  const db = createDbStub();
  setDbForTest(db);
  await db.collection('users').doc('U1').set({ memberNumber: 'M-001' });
  const profile = await getMemberProfile({ lineUserId: 'U1' });
  assert.strictEqual(profile.memberNumber, 'M-001');
});

test('setMemberNumber writes trimmed value', async () => {
  const db = createDbStub();
  setDbForTest(db);
  await setMemberNumber({ lineUserId: 'U2', memberNumber: '  M-002  ' });
  const stored = db._state.collections.users.docs['U2'].data;
  assert.strictEqual(stored.memberNumber, 'M-002');
});

test('setMemberNumber clears when empty', async () => {
  const db = createDbStub();
  setDbForTest(db);
  await setMemberNumber({ lineUserId: 'U3', memberNumber: '' });
  const stored = db._state.collections.users.docs['U3'].data;
  assert.strictEqual(stored.memberNumber, null);
});
