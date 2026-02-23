'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const { ADMIN_READINESS_ENDPOINTS } = require('../../tools/run_stg_notification_e2e_checklist');

test('phase633: stg e2e runner defines fixed six admin readiness endpoints', () => {
  const endpoints = ADMIN_READINESS_ENDPOINTS.map((item) => item.endpoint);
  assert.deepStrictEqual(endpoints, [
    '/api/admin/product-readiness',
    '/api/admin/read-path-fallback-summary',
    '/api/admin/retention-runs',
    '/api/admin/struct-drift/backfill-runs',
    '/api/admin/os/alerts/summary',
    '/api/admin/city-packs'
  ]);
});

test('phase633: product readiness scenario still runs before segment scenario', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'tools', 'run_stg_notification_e2e_checklist.js'), 'utf8');
  const readinessCall = "runScenario(ctx, 'product_readiness_gate'";
  const segmentCall = "runScenario(ctx, 'segment'";
  assert.ok(src.indexOf(readinessCall) < src.indexOf(segmentCall), 'product readiness gate must run before segment');
  assert.ok(src.includes('adminReadinessChecks'));
});
