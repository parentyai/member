'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase627: product readiness route reads retention risk artifact and exposes checks.retentionRisk', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/productReadiness.js'), 'utf8');
  assert.ok(src.includes('RETENTION_RISK_PATH'));
  assert.ok(src.includes('parseRetentionBudgets'));
  assert.ok(src.includes('readRetentionRisk'));
  assert.ok(src.includes('checks: {'));
  assert.ok(src.includes('retentionRisk: {'));
  assert.ok(src.includes('retention_risk_missing'));
  assert.ok(src.includes('retention_risk_generated_at_stale'));
});

