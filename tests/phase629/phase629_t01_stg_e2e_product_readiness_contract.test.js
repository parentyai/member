'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase629: stg e2e runner includes product readiness gate scenario before segment', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'tools/run_stg_notification_e2e_checklist.js'), 'utf8');
  const readinessCall = "runScenario(ctx, 'product_readiness_gate'";
  const segmentCall = "runScenario(ctx, 'segment'";
  assert.ok(src.includes(readinessCall));
  assert.ok(src.includes('/api/admin/product-readiness'));
  assert.ok(src.includes('product_readiness_no_go'));
  assert.ok(src.includes('product_readiness_retention_not_ok'));
  assert.ok(src.includes('product_readiness_structure_not_ok'));
  assert.ok(src.indexOf(readinessCall) < src.indexOf(segmentCall), 'product readiness gate must run before segment');
});
