'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase629: stg e2e runbook includes product readiness gate as first checklist item', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST.md'), 'utf8');
  assert.ok(text.includes('1. Product Readiness Gate'));
  assert.ok(text.includes('/api/admin/product-readiness'));
  assert.ok(text.includes('checks.retentionRisk.ok=true'));
  assert.ok(text.includes('checks.structureRisk.ok=true'));
});

test('phase629: stg e2e runbook includes product readiness trace naming guidance', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST.md'), 'utf8');
  assert.ok(text.includes('trace-stg-product-readiness-gate-<UTC compact>'));
});
