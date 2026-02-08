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

const { handleOpsDailyJob } = require('../../src/routes/phase65OpsDailyJob');
const { generateOpsDailyReport } = require('../../src/usecases/phase62/generateOpsDailyReport');

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

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase65: job is idempotent for same date', async () => {
  const original = process.env.OPS_JOB_TOKEN;
  process.env.OPS_JOB_TOKEN = 'secret';

  const deps = {
    generateOpsDailyReport: (params) => generateOpsDailyReport(params, {
      listOpsConsole: async () => ({ items: [] })
    })
  };

  const req = { url: '/api/phase65/ops/jobs/daily-report?date=2026-02-08', headers: { 'x-ops-job-token': 'secret' } };
  const res1 = createRes();
  await handleOpsDailyJob(req, res1, deps);
  const res2 = createRes();
  await handleOpsDailyJob(req, res2, deps);

  assert.strictEqual(res1.statusCode, 200);
  assert.strictEqual(res2.statusCode, 200);

  const collection = db._state.collections.ops_daily_reports;
  assert.ok(collection);
  assert.strictEqual(Object.keys(collection.docs).length, 1);

  if (original) {
    process.env.OPS_JOB_TOKEN = original;
  } else {
    delete process.env.OPS_JOB_TOKEN;
  }
});
