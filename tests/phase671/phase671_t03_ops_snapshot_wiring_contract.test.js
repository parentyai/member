'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase671: index and internal/admin routes wire ops system snapshot endpoints', () => {
  const indexCode = fs.readFileSync('src/index.js', 'utf8');
  const internalJobRoute = fs.readFileSync('src/routes/internal/opsSnapshotJob.js', 'utf8');
  const adminGlobalRoute = fs.readFileSync('src/routes/admin/opsSystemSnapshot.js', 'utf8');
  const adminCatalogRoute = fs.readFileSync('src/routes/admin/opsFeatureCatalogStatus.js', 'utf8');

  assert.ok(indexCode.includes("/api/admin/ops-system-snapshot"));
  assert.ok(indexCode.includes("/api/admin/ops-feature-catalog-status"));
  assert.ok(indexCode.includes("/api/admin/ops-system-snapshot/rebuild"));

  assert.ok(internalJobRoute.includes('targets: payload.targets'));
  assert.ok(internalJobRoute.includes('actor: \'ops_snapshot_job\''));
  assert.ok(internalJobRoute.includes('requireInternalJobToken'));
  assert.ok(internalJobRoute.includes('getKillSwitch'));

  assert.ok(adminGlobalRoute.includes("action: 'ops_system_snapshot.view'"));
  assert.ok(adminGlobalRoute.includes("targets: ['ops_system_snapshot']"));
  assert.ok(adminCatalogRoute.includes("action: 'ops_feature_catalog_status.view'"));
  assert.ok(adminCatalogRoute.includes("opsSnapshotsRepo.listSnapshots({ snapshotType: 'ops_feature_status', limit: 250 })"));
});

test('phase671: buildOpsSnapshots persists hybrid docs for ops system snapshot target', () => {
  const usecase = fs.readFileSync('src/usecases/admin/buildOpsSnapshots.js', 'utf8');

  assert.ok(usecase.includes("'ops_system_snapshot'"));
  assert.ok(usecase.includes("snapshotType: 'ops_system_snapshot'"));
  assert.ok(usecase.includes("snapshotKey: 'global'"));
  assert.ok(usecase.includes("snapshotType: 'ops_feature_status'"));
  assert.ok(usecase.includes("snapshotKey: 'catalog'"));
  assert.ok(usecase.includes('for (const row of rows)'));
  assert.ok(usecase.includes('const featureId = row && typeof row.featureId === \'string\''));
  assert.ok(usecase.includes('resolveOpsSystemSnapshotEnabled'));
});
