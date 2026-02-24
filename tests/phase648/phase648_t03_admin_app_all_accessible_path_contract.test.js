'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase648: admin app wires all-accessible nav visibility path', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('const ADMIN_NAV_ALL_ACCESSIBLE_V1 = resolveFrontendFeatureFlag('));
  assert.ok(src.includes('function resolveVisibleNavEntries(role)'));
  assert.ok(src.includes('resolveVisibleNavItemsByAllowedPanes'));
  assert.ok(src.includes('dedupeVisibleNavItemsByPane'));
  assert.ok(src.includes('resolveVisibleGroupKeysFromEntries'));
  assert.ok(src.includes('if (!ADMIN_NAV_ALL_ACCESSIBLE_V1 && !paneBlocked'));
  assert.ok(src.includes('if (ADMIN_NAV_ALL_ACCESSIBLE_V1) {'));
});
