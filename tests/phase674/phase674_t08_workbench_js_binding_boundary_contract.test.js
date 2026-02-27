'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function hasBinding(src, actionKey, elementId) {
  const escapedAction = actionKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedId = elementId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`bindWorkbenchAction\\(\\{[\\s\\S]*?actionKey:\\s*'${escapedAction}'[\\s\\S]*?elementId:\\s*'${escapedId}'`, 'm');
  return pattern.test(src);
}

test('phase674: workbench bindings are centralized via bindWorkbenchAction and guarded for dynamic action buttons', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(src.includes('function bindWorkbenchAction(params)'));
  assert.ok(src.includes("button.closest('[data-workbench-zone=\"true\"]')"));

  assert.ok(hasBinding(src, 'notifications.approve', 'approve'));
  assert.ok(hasBinding(src, 'notifications.send.plan', 'plan'));
  assert.ok(hasBinding(src, 'notifications.send.execute', 'execute'));
  assert.ok(hasBinding(src, 'city_pack.bulletin.create', 'city-pack-bulletin-create'));
  assert.ok(hasBinding(src, 'vendors.edit', 'vendor-edit'));
  assert.ok(hasBinding(src, 'vendors.activate', 'vendor-activate'));
  assert.ok(hasBinding(src, 'vendors.disable', 'vendor-disable'));

  assert.ok(!src.includes("document.getElementById('approve')?.addEventListener"));
  assert.ok(!src.includes("document.getElementById('plan')?.addEventListener"));
  assert.ok(!src.includes("document.getElementById('execute')?.addEventListener"));
  assert.ok(!src.includes("document.getElementById('vendor-edit')?.addEventListener"));
  assert.ok(!src.includes("document.getElementById('vendor-activate')?.addEventListener"));
  assert.ok(!src.includes("document.getElementById('vendor-disable')?.addEventListener"));
});
