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

const repo = require('../../src/repos/firestore/noticesRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase35: notices repo create/get/list/update', async () => {
  const created = await repo.createNotice({ title: 'Title', body: 'Body' });
  assert.ok(created.id);

  const notice = await repo.getNotice(created.id);
  assert.strictEqual(notice.title, 'Title');
  assert.strictEqual(notice.status, 'draft');

  const updated = await repo.updateNoticeStatus(created.id, 'active');
  assert.strictEqual(updated.status, 'active');

  const list = await repo.listNotices({ status: 'active' });
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].id, created.id);
});
