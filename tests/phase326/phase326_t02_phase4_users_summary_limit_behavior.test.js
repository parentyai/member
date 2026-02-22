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
const usersRepo = require('../../src/repos/firestore/usersRepo');
const { getUserOperationalSummary } = require('../../src/usecases/admin/getUserOperationalSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase326: user operational summary respects limit option', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo', createdAt: '2026-01-01T00:00:00Z' });
  await usersRepo.createUser('U2', { scenarioKey: 'A', stepKey: '3mo', createdAt: '2026-01-02T00:00:00Z' });

  const items = await getUserOperationalSummary({
    limit: 1,
    analyticsLimit: 10,
    useSnapshot: false
  });

  assert.strictEqual(items.length, 1);
});
