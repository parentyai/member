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

const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('linkRegistryRepo: setHealth stores WARN state', async () => {
  const created = await linkRegistryRepo.createLink({ title: 'x', url: 'https://x' });
  await linkRegistryRepo.setHealth(created.id, { checkedAt: 'now', statusCode: 500, state: 'WARN' });
  const list = await linkRegistryRepo.listLinks({ state: 'WARN' });
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].lastHealth.state, 'WARN');
});
