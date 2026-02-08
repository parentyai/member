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
const { createRun } = require('../../src/repos/firestore/automationRunsRepo');
const { handleRunStatus } = require('../../src/routes/phase90RunStatus');

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

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase90: run status route returns run', async () => {
  const created = await createRun({
    kind: 'SEGMENT_SEND',
    status: 'RUNNING',
    counters: { total: 5, attempted: 2, success: 2, failed: 0, skipped: 0 },
    limits: { batchSize: 50, rps: 10, maxRetries: 3 }
  });

  const res = createRes();
  const req = { url: `/api/phase90/automation-runs/${created.id}` };
  await handleRunStatus(req, res, created.id);

  assert.strictEqual(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.run.id, created.id);
  assert.strictEqual(payload.run.status, 'RUNNING');
});
