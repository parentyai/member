'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function createResponseCapture() {
  const result = { statusCode: null, headers: null, body: null };
  return {
    res: {
      writeHead: (statusCode, headers) => {
        result.statusCode = statusCode;
        result.headers = headers;
      },
      end: (text) => {
        result.body = text;
      }
    },
    readJson: () => (result.body ? JSON.parse(result.body) : null),
    result
  };
}

test('phase671: feature catalog route keeps ok=true when row list query fails and catalog rows exist', async (t) => {
  const repoPath = require.resolve('../../src/repos/firestore/opsSnapshotsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const routePath = require.resolve('../../src/routes/admin/opsFeatureCatalogStatus');
  const prevRepo = require.cache[repoPath];
  const prevAudit = require.cache[auditPath];
  const prevRoute = require.cache[routePath];
  const prevFlag = process.env.ENABLE_OPS_SYSTEM_SNAPSHOT_V1;

  process.env.ENABLE_OPS_SYSTEM_SNAPSHOT_V1 = '1';
  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getSnapshot: async () => ({
        id: 'ops_feature_status__catalog',
        snapshotType: 'ops_feature_status',
        snapshotKey: 'catalog',
        asOf: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        data: {
          status: 'WARN',
          counts: { ok: 24, warn: 1, alert: 0, unknown: 0 },
          rows: [
            {
              featureId: 'notice_notification',
              featureLabelJa: 'お知らせ通知',
              rowOrder: 1,
              status: 'WARN',
              reasonCodes: ['THRESHOLD_WARN'],
              updatedAt: '2026-03-01T00:00:00.000Z',
              lastUpdatedAt: '2026-03-01T00:00:00.000Z',
              stalenessSeconds: 0,
              detail: { pane: 'composer', apiPath: '/api/admin/os/notifications/list' }
            }
          ]
        }
      }),
      listSnapshots: async () => {
        throw new Error('FAILED_PRECONDITION: missing index');
      }
    }
  };
  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: {
      appendAuditLog: async () => ({ id: 'AUDIT_PHASE671_T07' })
    }
  };

  delete require.cache[routePath];
  const { handleOpsFeatureCatalogStatus } = require('../../src/routes/admin/opsFeatureCatalogStatus');

  t.after(() => {
    delete require.cache[routePath];
    if (prevRepo) require.cache[repoPath] = prevRepo;
    else delete require.cache[repoPath];
    if (prevAudit) require.cache[auditPath] = prevAudit;
    else delete require.cache[auditPath];
    if (prevRoute) require.cache[routePath] = prevRoute;
    if (prevFlag === undefined) delete process.env.ENABLE_OPS_SYSTEM_SNAPSHOT_V1;
    else process.env.ENABLE_OPS_SYSTEM_SNAPSHOT_V1 = prevFlag;
  });

  const capture = createResponseCapture();
  await handleOpsFeatureCatalogStatus({
    method: 'GET',
    headers: {
      'x-actor': 'phase671_t07',
      'x-trace-id': 'trace_phase671_t07'
    }
  }, capture.res);
  const body = capture.readJson();

  assert.equal(capture.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.rowSource, 'catalog');
  assert.deepEqual(body.warnings, ['ROW_DOCS_UNAVAILABLE']);
  assert.equal(Array.isArray(body.rows), true);
  assert.equal(body.rows.length, 1);
  assert.equal(body.rows[0].featureId, 'notice_notification');
});
