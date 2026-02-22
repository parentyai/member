'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase579: role switch supports operator/admin/developer in DOM and JS', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(html.includes('data-role-value="operator"'));
  assert.ok(html.includes('data-role-value="admin"'));
  assert.ok(html.includes('data-role-value="developer"'));
  assert.ok(js.includes("role === 'admin' || role === 'developer'"));
});
