'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase627: launch checklist includes retention readiness checks', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/LAUNCH_CHECKLIST.md'), 'utf8');
  assert.ok(text.includes('checks.retentionRisk.ok=true'));
  assert.ok(text.includes('retention_risk_freshness_max_hours'));
});

test('phase627: runbook ops includes retention readiness step', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/RUNBOOK_OPS.md'), 'utf8');
  assert.ok(text.includes('/api/admin/product-readiness'));
  assert.ok(text.includes('checks.retentionRisk'));
  assert.ok(text.includes('retention_risk_*'));
});

