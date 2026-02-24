'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { navCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase645: default rollout policy keeps operator excluded and admin/developer included', () => {
  assert.deepEqual(navCore.DEFAULT_NAV_GROUP_ROLLOUT_POLICY.operator, []);
  assert.deepEqual(navCore.DEFAULT_NAV_GROUP_ROLLOUT_POLICY.admin, ['communication', 'operations']);
  assert.deepEqual(navCore.DEFAULT_NAV_GROUP_ROLLOUT_POLICY.developer, ['communication', 'operations']);
});

test('phase645: visible nav resolution respects rollout and role', () => {
  const navItems = [
    { pane: 'alerts', groupKey: 'operations', rollout: 'admin,developer', priority: 50 },
    { pane: 'alerts', groupKey: 'catalog', priority: 10 }
  ];
  const groupPolicy = {
    operator: ['catalog'],
    admin: ['catalog', 'operations'],
    developer: ['catalog', 'operations']
  };
  const adminVisible = navCore.resolveVisibleNavItems(navItems, 'admin', { groupPolicy, rolloutEnabled: true });
  const operatorVisible = navCore.resolveVisibleNavItems(navItems, 'operator', { groupPolicy, rolloutEnabled: true });
  assert.equal(adminVisible.filter((item) => item.visible && item.groupKey === 'operations').length, 1);
  assert.equal(operatorVisible.filter((item) => item.visible && item.groupKey === 'operations').length, 0);
});
