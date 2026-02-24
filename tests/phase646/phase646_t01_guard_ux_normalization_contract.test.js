'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { fetchGuardCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase646: guard error normalization covers pane/role/rollout denial', () => {
  const pane = fetchGuardCore.normalizeGuardError({ error: 'pane_forbidden' });
  const role = fetchGuardCore.normalizeGuardError({ error: 'role_forbidden' });
  const rollout = fetchGuardCore.normalizeGuardError({ error: 'rollout_disabled' });

  assert.equal(pane.tone, 'warn');
  assert.equal(role.tone, 'warn');
  assert.equal(rollout.tone, 'warn');
  assert.ok(String(pane.cause).includes('遷移'));
  assert.ok(String(role.cause).includes('Role'));
  assert.ok(String(rollout.cause).includes('ロールアウト'));
});

test('phase646: app guard rendering keeps reason + recommended pane plumbing', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('recommendedPane'));
  assert.ok(src.includes('ROLLOUT_DISABLED'));
  assert.ok(src.includes('ROLE_FORBIDDEN'));
  assert.ok(src.includes('PANE_FORBIDDEN'));
});
