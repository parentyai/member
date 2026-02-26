'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { navCore } = require('../../apps/admin/assets/admin_ui_core.js');

const PANE_POLICY = Object.freeze({
  operator: Object.freeze(['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'emergency-layer', 'city-pack', 'audit', 'settings']),
  admin: Object.freeze(['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'emergency-layer', 'city-pack', 'audit', 'settings', 'llm', 'maintenance', 'developer-map', 'developer-manual-redac', 'developer-manual-user']),
  developer: Object.freeze(['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'emergency-layer', 'city-pack', 'audit', 'settings', 'llm', 'maintenance', 'developer-map', 'developer-manual-redac', 'developer-manual-user'])
});

test('phase637: resolveAllowedPane normalizes unpermitted panes to home fallback', () => {
  assert.equal(navCore.resolveAllowedPane('operator', 'alerts', PANE_POLICY, 'home'), 'alerts');
  assert.equal(navCore.resolveAllowedPane('operator', 'llm', PANE_POLICY, 'home'), 'home');
  assert.equal(navCore.resolveAllowedPane('admin', 'llm', PANE_POLICY, 'home'), 'llm');
  assert.equal(navCore.resolveAllowedPane('developer', 'developer-map', PANE_POLICY, 'home'), 'developer-map');
  assert.equal(navCore.resolveAllowedPane('unknown-role', 'settings', PANE_POLICY, 'home'), 'settings');
  assert.equal(navCore.resolveAllowedPane('operator', '', PANE_POLICY, 'home'), 'home');
});
