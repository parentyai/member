'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const REQUIRED_CRITICAL_ROUTES = [
  'GET /api/admin/product-readiness',
  'GET /api/admin/read-path-fallback-summary',
  'GET /api/admin/retention-runs',
  'GET /api/admin/struct-drift/backfill-runs',
  'GET /api/admin/os/alerts/summary',
  'GET /api/admin/city-packs'
];

test('phase657: firestore required index critical contracts include release-gate endpoints', () => {
  const payload = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/firestore_required_indexes.json', 'utf8'));
  const criticalRoutes = new Set((payload.criticalContracts || []).map((item) => item.routeOrUsecase));
  for (const route of REQUIRED_CRITICAL_ROUTES) {
    assert.ok(criticalRoutes.has(route), `criticalContracts must include ${route}`);
  }
});

test('phase657: critical contract runbook keeps endpoint list and check commands aligned', () => {
  const runbook = fs.readFileSync('docs/RUNBOOK_CRITICAL_CONTRACT_GUARD.md', 'utf8');
  for (const route of REQUIRED_CRITICAL_ROUTES) {
    assert.ok(runbook.includes(route), `runbook must include ${route}`);
  }
  assert.ok(runbook.includes('npm run firestore-indexes:check -- --contracts-only'));
  assert.ok(runbook.includes('npm run firestore-indexes:plan -- --project-id <PROJECT_ID>'));
});
