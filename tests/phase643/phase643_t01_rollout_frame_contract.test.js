'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { navCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase643: communication/operations groups declare rollout attributes', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('data-nav-group="communication" data-nav-surface="hidden" data-nav-rollout="admin,developer"'));
  assert.ok(html.includes('data-nav-group="operations" data-nav-surface="hidden" data-nav-rollout="admin,developer"'));
});

test('phase643: rollout flag injection and evaluator exist', () => {
  const indexSrc = fs.readFileSync('src/index.js', 'utf8');
  assert.ok(indexSrc.includes('window.ADMIN_NAV_ROLLOUT_V1='));
  assert.equal(navCore.isNavRolloutAllowed('operator', 'admin,developer', true), false);
  assert.equal(navCore.isNavRolloutAllowed('admin', 'admin,developer', true), true);
  assert.equal(navCore.isNavRolloutAllowed('developer', 'admin,developer', true), true);
  assert.equal(navCore.isNavRolloutAllowed('admin', 'admin,developer', false), false);
});
