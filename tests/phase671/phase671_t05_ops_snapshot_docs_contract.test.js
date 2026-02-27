'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase671: docs include ops-only nav and realtime snapshot contracts', () => {
  const dictionary = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');
  const runbook = fs.readFileSync('docs/RUNBOOK_ADMIN_OPS.md', 'utf8');
  const indexRequirements = fs.readFileSync('docs/INDEX_REQUIREMENTS.md', 'utf8');

  assert.ok(dictionary.includes('Phase671 Addendum（Ops-Only UI + Realtime Snapshot語彙）'));
  assert.ok(dictionary.includes('ui.label.nav.group.run'));
  assert.ok(dictionary.includes('ui.label.nav.group.control'));
  assert.ok(dictionary.includes('ui.label.ops.snapshot.lastUpdatedAt'));

  assert.ok(ssot.includes('Phase671 Add-only UI Contract（Ops-Only + Realtime Snapshot）'));
  assert.ok(ssot.includes('/api/admin/ops-system-snapshot'));
  assert.ok(ssot.includes('/api/admin/ops-feature-catalog-status'));
  assert.ok(ssot.includes('ENABLE_ADMIN_OPS_ONLY_NAV_V1'));
  assert.ok(ssot.includes('ENABLE_ADMIN_DEVELOPER_SURFACE_V1'));
  assert.ok(ssot.includes('ENABLE_OPS_REALTIME_DASHBOARD_V1'));
  assert.ok(ssot.includes('ENABLE_OPS_SYSTEM_SNAPSHOT_V1'));

  assert.ok(runbook.includes('Phase671 Addendum（Ops-Only運用 + Realtime Snapshot）'));
  assert.ok(runbook.includes('/internal/jobs/ops-snapshot-build'));
  assert.ok(runbook.includes('targets":["ops_system_snapshot"]'));
  assert.ok(runbook.includes('/api/admin/ops-system-snapshot/rebuild'));

  assert.ok(indexRequirements.includes('Phase671 Addendum（Ops Snapshot Read Model）'));
  assert.ok(indexRequirements.includes('ops_read_model_snapshots'));
  assert.ok(indexRequirements.includes('ops_system_snapshot__global'));
  assert.ok(indexRequirements.includes('ops_feature_status__catalog'));
});
