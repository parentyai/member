'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { navCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase637: removed legacy nav groups stay unreachable for all roles', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(!html.includes('data-nav-group="communication"'));
  assert.ok(!html.includes('data-nav-group="operations"'));
  assert.ok(css.includes('.app-nav .nav-group[data-nav-visible="false"]'));

  ['operator', 'admin', 'developer'].forEach((role) => {
    assert.equal(navCore.isGroupVisible(role, 'communication'), false);
    assert.equal(navCore.isGroupVisible(role, 'operations'), false);
  });
});
