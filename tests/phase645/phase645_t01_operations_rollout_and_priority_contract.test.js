'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { navCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase645: default rollout policy is empty for all roles', () => {
  assert.deepEqual(navCore.DEFAULT_NAV_GROUP_ROLLOUT_POLICY.operator, []);
  assert.deepEqual(navCore.DEFAULT_NAV_GROUP_ROLLOUT_POLICY.admin, []);
  assert.deepEqual(navCore.DEFAULT_NAV_GROUP_ROLLOUT_POLICY.developer, []);
});

test('phase645: visible nav resolution respects rollout and role', () => {
  const navItems = [
    { pane: 'alerts', groupKey: 'control', rollout: 'admin,developer', priority: 50 },
    { pane: 'alerts', groupKey: 'dashboard', priority: 10 }
  ];
  const groupPolicy = {
    operator: ['dashboard', 'control'],
    admin: ['dashboard', 'control'],
    developer: ['dashboard', 'control']
  };
  const adminVisible = navCore.resolveVisibleNavItems(navItems, 'admin', { groupPolicy, rolloutEnabled: true });
  const operatorVisible = navCore.resolveVisibleNavItems(navItems, 'operator', { groupPolicy, rolloutEnabled: true });
  assert.equal(adminVisible.filter((item) => item.visible && item.groupKey === 'control').length, 1);
  assert.equal(operatorVisible.filter((item) => item.visible && item.groupKey === 'control').length, 0);
});
