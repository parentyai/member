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
const sourceAuditRunsRepo = require('../../src/repos/firestore/sourceAuditRunsRepo');

test('phase250: source audit runs list uses startedAt desc ordering with limit', async () => {
  const prevFlag = process.env.ENABLE_CITY_PACK_AUDIT_RUNS_ORDERBY_V1;
  process.env.ENABLE_CITY_PACK_AUDIT_RUNS_ORDERBY_V1 = '1';
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await sourceAuditRunsRepo.saveRun('run_order_001', {
      runId: 'run_order_001',
      startedAt: '2026-03-01T00:00:00.000Z'
    });
    await sourceAuditRunsRepo.saveRun('run_order_002', {
      runId: 'run_order_002',
      startedAt: '2026-03-03T00:00:00.000Z'
    });
    await sourceAuditRunsRepo.saveRun('run_order_003', {
      runId: 'run_order_003',
      startedAt: '2026-03-02T00:00:00.000Z'
    });

    const rows = await sourceAuditRunsRepo.listRuns(2);
    assert.strictEqual(rows.length, 2);
    assert.deepStrictEqual(rows.map((row) => row.runId || row.id), ['run_order_002', 'run_order_003']);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevFlag === undefined) delete process.env.ENABLE_CITY_PACK_AUDIT_RUNS_ORDERBY_V1;
    else process.env.ENABLE_CITY_PACK_AUDIT_RUNS_ORDERBY_V1 = prevFlag;
  }
});

test('phase250: source audit runs list falls back to legacy sort when orderBy query fails', async () => {
  const prevFlag = process.env.ENABLE_CITY_PACK_AUDIT_RUNS_ORDERBY_V1;
  process.env.ENABLE_CITY_PACK_AUDIT_RUNS_ORDERBY_V1 = '1';
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await sourceAuditRunsRepo.saveRun('run_fallback_001', {
      runId: 'run_fallback_001',
      startedAt: '2026-03-01T00:00:00.000Z'
    });
    await sourceAuditRunsRepo.saveRun('run_fallback_002', {
      runId: 'run_fallback_002',
      startedAt: '2026-03-02T00:00:00.000Z'
    });

    const originalCollection = db.collection.bind(db);
    db.collection = (name) => {
      const col = originalCollection(name);
      if (name !== 'source_audit_runs') return col;
      return Object.assign({}, col, {
        orderBy() {
          throw new Error('orderBy unavailable');
        }
      });
    };

    const rows = await sourceAuditRunsRepo.listRuns(2);
    assert.strictEqual(rows.length, 2);
    assert.deepStrictEqual(rows.map((row) => row.runId || row.id), ['run_fallback_002', 'run_fallback_001']);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevFlag === undefined) delete process.env.ENABLE_CITY_PACK_AUDIT_RUNS_ORDERBY_V1;
    else process.env.ENABLE_CITY_PACK_AUDIT_RUNS_ORDERBY_V1 = prevFlag;
  }
});
