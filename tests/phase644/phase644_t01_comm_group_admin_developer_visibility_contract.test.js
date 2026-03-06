'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase644: app rollout policy is fully disabled for nav-group simplification', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('const NAV_GROUP_ROLLOUT_POLICY'));
  assert.ok(src.includes('admin: Object.freeze([])'));
  assert.ok(src.includes('developer: Object.freeze([])'));
  assert.ok(src.includes('operator: Object.freeze([])'));
  assert.ok(src.includes('function resolveNavGroupVisibilityPolicy()'));
});
