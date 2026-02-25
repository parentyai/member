'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase664: admin app defines degraded boot loader path for local preflight block', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('async function runInitialDataLoads(options)'));
  assert.ok(src.includes('if (isLocalPreflightBlockingDataLoads()) {'));
  assert.ok(src.includes("mode: 'degraded'"));
  assert.ok(src.includes("pendingBootstrapLoads: true"));
  assert.ok(src.includes("currentEl.textContent = t('ui.value.dashboard.blocked', 'BLOCKED');"));
});

test('phase664: bootstrap uses runInitialDataLoads after preflight', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes("await loadLocalPreflight({ notify: false });"));
  assert.ok(src.includes("await runInitialDataLoads({ notify: false, source: 'bootstrap' });"));
});
