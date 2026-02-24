'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { navCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase639: navCore exposes policy defaults and deterministic policy hash', () => {
  assert.ok(navCore.DEFAULT_NAV_PANE_POLICY);
  assert.ok(navCore.DEFAULT_NAV_GROUP_VISIBILITY_POLICY);
  assert.ok(navCore.DEFAULT_NAV_GROUP_ROLLOUT_POLICY);
  assert.equal(typeof navCore.resolvePolicyHash, 'function');
  const left = navCore.resolvePolicyHash({ a: [1, 2], b: { c: true } });
  const right = navCore.resolvePolicyHash({ b: { c: true }, a: [1, 2] });
  assert.equal(left, right);
});

test('phase639: admin app resolves policy from core and keeps drift sentinel fields', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('function resolvePanePolicy()'));
  assert.ok(src.includes('function resolveNavGroupVisibilityPolicy()'));
  assert.ok(src.includes('function resolveNavPolicyHashes()'));
  assert.ok(src.includes('state.navPolicyHashApp'));
  assert.ok(src.includes('state.navPolicyHashCore'));
});
