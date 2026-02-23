'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { noFoldContract } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase635: no-fold css contract and role policy hooks are present', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.equal(noFoldContract.isNoFoldCssReady(css), true);
  assert.ok(css.includes('[data-role-allow].role-hidden'));
  assert.ok(html.includes('/admin/assets/admin_ui_core.js'));
  assert.ok(html.includes('data-role-allow="admin,developer"'));
  assert.ok(js.includes('function applyRoleNavPolicy('));
});
