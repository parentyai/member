'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { navCore } = require('../../apps/admin/assets/admin_ui_core.js');

const PANE_POLICY = Object.freeze({
  operator: Object.freeze(['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'emergency-layer', 'city-pack', 'audit', 'settings']),
  admin: Object.freeze(['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'emergency-layer', 'city-pack', 'audit', 'settings', 'llm', 'maintenance', 'developer-map', 'developer-manual-redac', 'developer-manual-user']),
  developer: Object.freeze(['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'emergency-layer', 'city-pack', 'audit', 'settings', 'llm', 'maintenance', 'developer-map', 'developer-manual-redac', 'developer-manual-user'])
});

test('phase648: allowed-pane visibility keeps operator navigation reachable and dedupes cross-group duplicates', () => {
  const navItems = [
    { pane: 'alerts', groupKey: 'control', priority: 229, allowList: [] },
    { pane: 'alerts', groupKey: 'dashboard', priority: 5, allowList: [] },
    { pane: 'audit', groupKey: 'control', priority: 223, allowList: [] },
    { pane: 'audit', groupKey: 'run', priority: 10, allowList: [] },
    { pane: 'composer', groupKey: 'run', priority: 240, allowList: [] },
    { pane: 'composer', groupKey: 'run', priority: 220, allowList: [] },
    { pane: 'llm', groupKey: 'control', priority: 225, allowList: ['admin', 'developer'] }
  ];

  const visible = navCore.resolveVisibleNavItemsByAllowedPanes(navItems, 'operator', PANE_POLICY, { useRollout: false });
  const deduped = navCore.dedupeVisibleNavItemsByPane(visible, { preserveSameGroup: true });

  assert.equal(deduped.filter((item) => item.visible && item.pane === 'alerts').length, 1);
  assert.equal(deduped.filter((item) => item.visible && item.pane === 'audit' && item.groupKey === 'control').length, 1);
  assert.equal(deduped.filter((item) => item.visible && item.pane === 'audit' && item.groupKey === 'run').length, 0);
  assert.equal(deduped.filter((item) => item.visible && item.pane === 'composer').length, 2);
  assert.equal(deduped.filter((item) => item.visible && item.pane === 'llm').length, 0);

  const visibleGroups = navCore.resolveVisibleGroupsFromItems(deduped);
  assert.ok(visibleGroups.includes('run'));
  assert.ok(visibleGroups.includes('control'));
});
