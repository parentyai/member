'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { stateCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase640: stateCore persists role with URL > storage > default priority', () => {
  assert.equal(stateCore.parseRoleFromQuery('?pane=home&role=developer'), 'developer');
  assert.equal(stateCore.parseRoleFromQuery('?pane=home'), null);
  assert.equal(stateCore.resolveRoleState('admin', 'developer', 'operator'), 'admin');
  assert.equal(stateCore.resolveRoleState(null, 'developer', 'operator'), 'developer');
  assert.equal(stateCore.resolveRoleState(null, null, 'operator'), 'operator');
  const nextUrl = stateCore.applyRoleToUrl('admin', 'http://localhost/admin/app?pane=home');
  assert.ok(nextUrl.includes('role=admin'));
});

test('phase640: admin app hydrates role from persistence path', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('ADMIN_ROLE_PERSIST_ENABLED'));
  assert.ok(src.includes('function resolveRoleFromPersistence('));
  assert.ok(src.includes('function persistRoleState('));
  assert.ok(src.includes('state.role = resolveRoleFromPersistence(state.role);'));
});
