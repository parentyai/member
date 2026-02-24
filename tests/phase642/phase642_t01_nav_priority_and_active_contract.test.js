'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { navCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase642: nav items define priority and visibility attribute contract', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  assert.ok(html.includes('id="nav-open-settings" class="nav-item" data-pane-target="settings" data-nav-priority='));
  assert.ok(html.includes('data-pane-target="alerts" data-nav-priority='));
  assert.ok(css.includes('.app-nav .nav-item[data-nav-item-visible="false"]'));
  assert.ok(css.includes('.app-nav .nav-item[data-nav-item-visible="true"]'));
});

test('phase642: navCore resolves active nav item by deterministic priority', () => {
  const items = [
    { pane: 'settings', groupKey: 'catalog', priority: 10 },
    { pane: 'settings', groupKey: 'catalog', priority: 99 }
  ];
  const resolved = navCore.resolveActiveNavItem(items, 'settings', 'operator', {
    groupPolicy: { operator: ['catalog'], admin: ['catalog'], developer: ['catalog'] },
    rolloutEnabled: true,
    fallbackPane: 'settings'
  });
  assert.ok(resolved);
  assert.equal(resolved.priority, 99);
});
