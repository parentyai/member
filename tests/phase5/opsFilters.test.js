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

const usersRepo = require('../../src/repos/firestore/usersRepo');
const checklistsRepo = require('../../src/repos/firestore/checklistsRepo');
const userChecklistsRepo = require('../../src/repos/firestore/userChecklistsRepo');
const { handleUsersSummaryFiltered } = require('../../src/routes/phase5Ops');

const fixedNow = new Date('2026-01-20T00:00:00Z').getTime();
let realNow = null;

function createRes() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

async function seedData() {
  await usersRepo.createUser('U1', { memberNumber: null, createdAt: '2025-12-01T00:00:00Z' });
  await usersRepo.createUser('U2', { memberNumber: 'M2', createdAt: '2026-01-10T00:00:00Z' });
  await usersRepo.createUser('U3', { memberNumber: 'M3', scenarioKey: 'A', stepKey: '3mo', createdAt: '2026-01-01T00:00:00Z' });

  const checklist = await checklistsRepo.createChecklist({
    scenario: 'A',
    step: '3mo',
    items: [
      { itemId: 'i1', title: 't1', linkRegistryId: 'L1', order: 1 },
      { itemId: 'i2', title: 't2', linkRegistryId: 'L2', order: 2 }
    ]
  });

  await userChecklistsRepo.upsertUserChecklist({
    lineUserId: 'U3',
    checklistId: checklist.id,
    itemId: 'i1',
    completedAt: 'DONE'
  });

  await usersRepo.updateUser('U2', {
    opsReviewLastReviewedAt: '2026-01-15T00:00:00Z',
    opsReviewLastReviewedBy: 'op2'
  });
  await usersRepo.updateUser('U3', {
    opsReviewLastReviewedAt: '2025-12-20T00:00:00Z',
    opsReviewLastReviewedBy: 'op3'
  });
}

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
  realNow = Date.now;
  Date.now = () => fixedNow;
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
  Date.now = realNow;
});

test('ops filters: no params keeps all items', async () => {
  await seedData();
  const res = createRes();
  await handleUsersSummaryFiltered({ url: '/api/phase5/ops/users-summary' }, res);
  const data = JSON.parse(res.body);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(data.items.length, 3);
});

test('ops filters: needsAttention', async () => {
  await seedData();
  const res = createRes();
  await handleUsersSummaryFiltered({ url: '/api/phase5/ops/users-summary?needsAttention=1' }, res);
  const data = JSON.parse(res.body);
  const ids = data.items.map((item) => item.lineUserId).sort();
  assert.deepStrictEqual(ids, ['U1', 'U3']);
});

test('ops filters: stale', async () => {
  await seedData();
  const res = createRes();
  await handleUsersSummaryFiltered({ url: '/api/phase5/ops/users-summary?stale=1' }, res);
  const data = JSON.parse(res.body);
  assert.strictEqual(data.items.length, 1);
  assert.strictEqual(data.items[0].lineUserId, 'U1');
});

test('ops filters: unreviewed', async () => {
  await seedData();
  const res = createRes();
  await handleUsersSummaryFiltered({ url: '/api/phase5/ops/users-summary?unreviewed=1' }, res);
  const data = JSON.parse(res.body);
  assert.strictEqual(data.items.length, 1);
  assert.strictEqual(data.items[0].lineUserId, 'U1');
});

test('ops filters: reviewAgeDays', async () => {
  await seedData();
  const res = createRes();
  await handleUsersSummaryFiltered({ url: '/api/phase5/ops/users-summary?reviewAgeDays=14' }, res);
  const data = JSON.parse(res.body);
  const ids = data.items.map((item) => item.lineUserId).sort();
  assert.deepStrictEqual(ids, ['U1', 'U3']);
});

test('ops filters: invalid reviewAgeDays returns 400', async () => {
  const res = createRes();
  await handleUsersSummaryFiltered({ url: '/api/phase5/ops/users-summary?reviewAgeDays=0' }, res);
  assert.strictEqual(res.statusCode, 400);
});
