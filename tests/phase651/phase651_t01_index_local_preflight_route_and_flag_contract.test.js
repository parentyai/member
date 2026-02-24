'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase651: index wires local preflight flag, boot script, and API route', () => {
  const src = fs.readFileSync('src/index.js', 'utf8');
  assert.ok(src.includes("ENABLE_ADMIN_LOCAL_PREFLIGHT_V1"));
  assert.ok(src.includes('function resolveAdminLocalPreflightFlag()'));
  assert.ok(src.includes('window.ENABLE_ADMIN_LOCAL_PREFLIGHT_V1='));
  assert.ok(src.includes("pathname === '/api/admin/local-preflight'"));
  assert.ok(src.includes("require('./routes/admin/localPreflight')"));
});
