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

test('phase671: ops snapshot rebuild -> global view -> catalog view roundtrip', async (t) => {
  const buildUsecasePath = require.resolve('../../src/usecases/admin/buildOpsSnapshots');
  const snapshotRepoPath = require.resolve('../../src/repos/firestore/opsSnapshotsRepo');
  const auditUsecasePath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const globalRoutePath = require.resolve('../../src/routes/admin/opsSystemSnapshot');
  const catalogRoutePath = require.resolve('../../src/routes/admin/opsFeatureCatalogStatus');

  const previousBuildUsecase = require.cache[buildUsecasePath];
  const previousRepo = require.cache[snapshotRepoPath];
  const previousAuditUsecase = require.cache[auditUsecasePath];
  const previousGlobalRoute = require.cache[globalRoutePath];
  const previousCatalogRoute = require.cache[catalogRoutePath];
  const previousFlag = process.env.ENABLE_OPS_SYSTEM_SNAPSHOT_V1;

  const store = {
    global: null,
    catalog: null,
    rows: []
  };

  process.env.ENABLE_OPS_SYSTEM_SNAPSHOT_V1 = '1';

  require.cache[buildUsecasePath] = {
    id: buildUsecasePath,
    filename: buildUsecasePath,
    loaded: true,
    exports: {
      buildOpsSnapshots: async (params) => {
        assert.deepEqual(params.targets, ['ops_system_snapshot']);
        const nowIso = '2026-02-27T12:34:56.000Z';
        store.global = {
          id: 'ops_system_snapshot__global',
          snapshotType: 'ops_system_snapshot',
          snapshotKey: 'global',
          asOf: nowIso,
          updatedAt: nowIso,
          data: {
            status: 'WARN',
            reasonCodes: ['THRESHOLD_WARN'],
            updatedAt: nowIso,
            lastUpdatedAt: nowIso,
            stalenessSeconds: 0,
            sections: {
              notifications: {
                status: 'WARN',
                reasonCodes: ['THRESHOLD_WARN'],
                updatedAt: nowIso,
                lastUpdatedAt: nowIso,
                metrics: { failedCount: 1, todaySentCount: 12 }
              },
              systemHealth: {
                status: 'OK',
                reasonCodes: [],
                updatedAt: nowIso,
                lastUpdatedAt: nowIso,
                metrics: { productReadiness: 'GO' }
              }
            },
            featureSummary: { ok: 23, warn: 2, alert: 0, unknown: 0 }
          }
        };
        store.catalog = {
          id: 'ops_feature_status__catalog',
          snapshotType: 'ops_feature_status',
          snapshotKey: 'catalog',
          asOf: nowIso,
          updatedAt: nowIso,
          data: {
            status: 'WARN',
            updatedAt: nowIso,
            lastUpdatedAt: nowIso,
            counts: { ok: 23, warn: 2, alert: 0, unknown: 0 },
            rows: []
          }
        };
        store.rows = [
          {
            id: 'ops_feature_status__notice_notification',
            snapshotType: 'ops_feature_status',
            snapshotKey: 'notice_notification',
            asOf: nowIso,
            updatedAt: nowIso,
            data: {
              featureId: 'notice_notification',
              featureLabelJa: 'お知らせ通知',
              group: 'Run',
              rowOrder: 1,
              status: 'WARN',
              reasonCodes: ['THRESHOLD_WARN'],
              updatedAt: nowIso,
              lastUpdatedAt: nowIso,
              stalenessSeconds: 0,
              detail: {
                pane: 'composer',
                apiPath: '/api/admin/os/notifications/list'
              }
            }
          }
        ];
        return {
          ok: true,
          summary: {
            snapshotsBuilt: 3
          }
        };
      }
    }
  };

  require.cache[snapshotRepoPath] = {
    id: snapshotRepoPath,
    filename: snapshotRepoPath,
    loaded: true,
    exports: {
      getSnapshot: async (snapshotType, snapshotKey) => {
        if (snapshotType === 'ops_system_snapshot' && snapshotKey === 'global') return store.global;
        if (snapshotType === 'ops_feature_status' && snapshotKey === 'catalog') return store.catalog;
        return store.rows.find((row) => row.snapshotType === snapshotType && row.snapshotKey === snapshotKey) || null;
      },
      listSnapshots: async (params) => {
        if (!params || params.snapshotType !== 'ops_feature_status') return [];
        return [store.catalog].concat(store.rows).filter(Boolean);
      }
    }
  };

  require.cache[auditUsecasePath] = {
    id: auditUsecasePath,
    filename: auditUsecasePath,
    loaded: true,
    exports: {
      appendAuditLog: async () => ({ id: 'AUDIT_PHASE671' })
    }
  };

  delete require.cache[globalRoutePath];
  delete require.cache[catalogRoutePath];

  const { handleOpsSystemSnapshotRebuild, handleOpsSystemSnapshot } = require('../../src/routes/admin/opsSystemSnapshot');
  const { handleOpsFeatureCatalogStatus } = require('../../src/routes/admin/opsFeatureCatalogStatus');

  t.after(() => {
    delete require.cache[globalRoutePath];
    delete require.cache[catalogRoutePath];
    if (previousBuildUsecase) require.cache[buildUsecasePath] = previousBuildUsecase;
    else delete require.cache[buildUsecasePath];
    if (previousRepo) require.cache[snapshotRepoPath] = previousRepo;
    else delete require.cache[snapshotRepoPath];
    if (previousAuditUsecase) require.cache[auditUsecasePath] = previousAuditUsecase;
    else delete require.cache[auditUsecasePath];
    if (previousGlobalRoute) require.cache[globalRoutePath] = previousGlobalRoute;
    if (previousCatalogRoute) require.cache[catalogRoutePath] = previousCatalogRoute;
    if (previousFlag === undefined) delete process.env.ENABLE_OPS_SYSTEM_SNAPSHOT_V1;
    else process.env.ENABLE_OPS_SYSTEM_SNAPSHOT_V1 = previousFlag;
  });

  const rebuildCapture = createResponseCapture();
  await handleOpsSystemSnapshotRebuild({
    method: 'POST',
    headers: {
      'x-actor': 'phase671_test',
      'x-trace-id': 'trace_phase671_rebuild'
    }
  }, rebuildCapture.res, JSON.stringify({ dryRun: false, scanLimit: 1200 }));

  const rebuildBody = rebuildCapture.readJson();
  assert.equal(rebuildCapture.result.statusCode, 200);
  assert.equal(rebuildBody.ok, true);
  assert.equal(store.global.snapshotKey, 'global');

  const globalCapture = createResponseCapture();
  await handleOpsSystemSnapshot({
    method: 'GET',
    headers: {
      'x-actor': 'phase671_test',
      'x-trace-id': 'trace_phase671_view'
    }
  }, globalCapture.res);

  const globalBody = globalCapture.readJson();
  assert.equal(globalCapture.result.statusCode, 200);
  assert.equal(globalBody.ok, true);
  assert.equal(globalBody.available, true);
  assert.equal(globalBody.snapshot.status, 'WARN');
  assert.equal(globalBody.snapshot.sections.notifications.status, 'WARN');

  const catalogCapture = createResponseCapture();
  await handleOpsFeatureCatalogStatus({
    method: 'GET',
    headers: {
      'x-actor': 'phase671_test',
      'x-trace-id': 'trace_phase671_catalog'
    }
  }, catalogCapture.res);

  const catalogBody = catalogCapture.readJson();
  assert.equal(catalogCapture.result.statusCode, 200);
  assert.equal(catalogBody.ok, true);
  assert.equal(catalogBody.available, true);
  assert.equal(Array.isArray(catalogBody.rows), true);
  assert.equal(catalogBody.rows.length, 1);
  assert.equal(catalogBody.rows[0].featureId, 'notice_notification');
});
