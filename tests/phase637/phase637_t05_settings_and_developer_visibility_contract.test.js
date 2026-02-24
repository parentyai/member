'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { navCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase637: settings remains role-agnostic and developer links remain developer-scoped', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

  assert.ok(html.includes('id="nav-open-settings"'));
  assert.ok(!html.includes('id="nav-open-settings" data-role='));
  assert.ok(html.includes('class="nav-group nav-group-developer" data-nav-group="developer" data-nav-surface="secondary" data-role="developer"'));

  assert.equal(navCore.isGroupVisible('operator', 'developer'), false);
  assert.equal(navCore.isGroupVisible('admin', 'developer'), false);
  assert.equal(navCore.isGroupVisible('developer', 'developer'), true);
});
