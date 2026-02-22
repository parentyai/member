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
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');
const { handleRetentionRuns } = require('../../src/routes/admin/retentionRuns');

function createRes() {
  return {
    statusCode: 0,
    headers: null,
    body: '',
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(payload) {
      this.body = payload || '';
    }
  };
}

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase336: retention-runs returns retention actions only and maps payload fields', async () => {
  await auditLogsRepo.appendAuditLog({
    actor: 'job',
    action: 'retention.dry_run.execute',
    entityType: 'retention_policy',
    entityId: 'global',
    traceId: 'trace_ret_1',
    createdAt: '2026-01-01T00:00:00Z',
    payloadSummary: {
      dryRun: true,
      collections: ['events'],
      summary: { deletedCount: 0 }
    }
  });
  await auditLogsRepo.appendAuditLog({
    actor: 'job',
    action: 'retention.apply.execute',
    entityType: 'retention_policy',
    entityId: 'global',
    traceId: 'trace_ret_1',
    createdAt: '2026-01-02T00:00:00Z',
    payloadSummary: {
      dryRunTraceId: 'trace_dry',
      collections: ['events'],
      summary: { deletedCount: 3 },
      deletedSamples: [{ collection: 'events', ids: ['e1', 'e2'] }]
    }
  });
  await auditLogsRepo.appendAuditLog({
    actor: 'job',
    action: 'unrelated.action',
    entityType: 'x',
    entityId: 'x',
    traceId: 'trace_ret_1',
    createdAt: '2026-01-03T00:00:00Z',
    payloadSummary: {}
  });

  const req = {
    method: 'GET',
    url: '/api/admin/retention-runs?traceId=trace_ret_1&limit=10',
    headers: {
      'x-actor': 'admin_tester',
      'x-trace-id': 'trace_view_1'
    }
  };
  const res = createRes();
  await handleRetentionRuns(req, res);

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body || '{}');
  assert.strictEqual(body.ok, true);
  assert.ok(Array.isArray(body.items));
  assert.strictEqual(body.items.length, 2);
  const actions = new Set(body.items.map((item) => item.action));
  assert.ok(actions.has('retention.dry_run.execute'));
  assert.ok(actions.has('retention.apply.execute'));
  const apply = body.items.find((item) => item.action === 'retention.apply.execute');
  assert.strictEqual(apply.deletedCount, 3);
  assert.strictEqual(apply.dryRunTraceId, 'trace_dry');
  assert.deepStrictEqual(apply.sampleDeletedIds, ['e1', 'e2']);
});
