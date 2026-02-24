'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase648: admin app bootstrap exposes nav-all-accessible feature flag', () => {
  const src = fs.readFileSync('src/index.js', 'utf8');
  assert.ok(src.includes('function resolveAdminNavAllAccessibleFlag()'));
  assert.ok(src.includes("resolveBooleanEnvFlag('ENABLE_ADMIN_NAV_ALL_ACCESSIBLE_V1', true)"));
  assert.ok(src.includes('window.ADMIN_NAV_ALL_ACCESSIBLE_V1='));
});
