'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase651: package scripts include admin preflight and phase651 contracts', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(typeof pkg.scripts['admin:preflight'], 'string');
  assert.ok(pkg.scripts['admin:preflight'].includes('tools/admin_local_preflight.js'));
  assert.ok(pkg.scripts['test:admin-nav-contract'].includes('tests/phase651/*.test.js'));
});

test('phase651: runbook and SSOT mention local preflight operational checks', () => {
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');
  const runbook = fs.readFileSync('docs/RUNBOOK_ADMIN_OPS.md', 'utf8');
  assert.ok(ssot.includes('ENABLE_ADMIN_LOCAL_PREFLIGHT_V1'));
  assert.ok(ssot.includes('/api/admin/local-preflight'));
  assert.ok(runbook.includes('admin:preflight'));
  assert.ok(runbook.includes('/api/admin/local-preflight'));
});
