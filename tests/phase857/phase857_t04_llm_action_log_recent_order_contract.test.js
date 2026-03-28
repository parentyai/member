'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const llmActionLogsRepo = require('../../src/repos/firestore/llmActionLogsRepo');

test('phase857: listLlmActionLogsByLineUserId returns latest rows first with limit applied', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TS');

  try {
    await llmActionLogsRepo.appendLlmActionLog({
      traceId: 'trace_phase857_old',
      requestId: 'trace_phase857_old',
      lineUserId: 'U_PHASE857_RECENT',
      createdAt: '2026-03-26T10:00:00.000Z'
    });
    await llmActionLogsRepo.appendLlmActionLog({
      traceId: 'trace_phase857_mid',
      requestId: 'trace_phase857_mid',
      lineUserId: 'U_PHASE857_RECENT',
      createdAt: '2026-03-26T10:01:00.000Z'
    });
    await llmActionLogsRepo.appendLlmActionLog({
      traceId: 'trace_phase857_new',
      requestId: 'trace_phase857_new',
      lineUserId: 'U_PHASE857_RECENT',
      createdAt: '2026-03-26T10:02:00.000Z'
    });

    const rows = await llmActionLogsRepo.listLlmActionLogsByLineUserId({
      lineUserId: 'U_PHASE857_RECENT',
      limit: 2
    });

    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.traceId), [
      'trace_phase857_new',
      'trace_phase857_mid'
    ]);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase857: listLlmActionLogsByLineUserId falls back to unbounded read when ordered query is unavailable', async () => {
  const infraPath = require.resolve('../../src/infra/firestore');
  const repoPath = require.resolve('../../src/repos/firestore/llmActionLogsRepo');
  const savedInfra = require.cache[infraPath];
  const savedRepo = require.cache[repoPath];

  const docs = [
    {
      id: 'older',
      data: () => ({
        traceId: 'trace_phase857_fb_old',
        requestId: 'trace_phase857_fb_old',
        lineUserId: 'U_PHASE857_FB',
        createdAt: '2026-03-26T09:58:00.000Z'
      })
    },
    {
      id: 'newest',
      data: () => ({
        traceId: 'trace_phase857_fb_new',
        requestId: 'trace_phase857_fb_new',
        lineUserId: 'U_PHASE857_FB',
        createdAt: '2026-03-26T10:03:00.000Z'
      })
    },
    {
      id: 'middle',
      data: () => ({
        traceId: 'trace_phase857_fb_mid',
        requestId: 'trace_phase857_fb_mid',
        lineUserId: 'U_PHASE857_FB',
        createdAt: '2026-03-26T10:01:00.000Z'
      })
    }
  ];

  const fakeDb = {
    collection: () => ({
      where: () => ({
        orderBy: () => {
          throw new Error('missing composite index');
        },
        get: async () => ({ docs })
      })
    })
  };

  try {
    require.cache[infraPath] = {
      id: infraPath,
      filename: infraPath,
      loaded: true,
      exports: {
        getDb: () => fakeDb,
        serverTimestamp: () => 'SERVER_TS'
      }
    };
    delete require.cache[repoPath];
    const repo = require(repoPath);

    const rows = await repo.listLlmActionLogsByLineUserId({
      lineUserId: 'U_PHASE857_FB',
      limit: 2
    });

    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.traceId), [
      'trace_phase857_fb_new',
      'trace_phase857_fb_mid'
    ]);
  } finally {
    if (savedInfra) require.cache[infraPath] = savedInfra;
    else delete require.cache[infraPath];
    if (savedRepo) require.cache[repoPath] = savedRepo;
    else delete require.cache[repoPath];
  }
});

test('phase857: listLlmActionLogsByLineUserId overfetches when excluding synthetic patrol replay rows', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TS');

  try {
    await llmActionLogsRepo.appendLlmActionLog({
      traceId: 'trace_phase857_real_old',
      requestId: 'trace_phase857_real_old',
      lineUserId: 'U_PHASE857_SYNTHETIC',
      createdAt: '2026-03-26T10:00:00.000Z'
    });
    await llmActionLogsRepo.appendLlmActionLog({
      traceId: 'quality_patrol_cycle_123_0',
      requestId: 'quality_patrol_cycle_123_0',
      lineUserId: 'U_PHASE857_SYNTHETIC',
      createdAt: '2026-03-26T10:02:00.000Z'
    });
    await llmActionLogsRepo.appendLlmActionLog({
      traceId: 'quality_patrol_cycle_123_1',
      requestId: 'quality_patrol_cycle_123_1',
      lineUserId: 'U_PHASE857_SYNTHETIC',
      createdAt: '2026-03-26T10:01:00.000Z'
    });

    const rows = await llmActionLogsRepo.listLlmActionLogsByLineUserId({
      lineUserId: 'U_PHASE857_SYNTHETIC',
      limit: 1,
      excludeSyntheticPatrolReplay: true
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].traceId, 'trace_phase857_real_old');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
