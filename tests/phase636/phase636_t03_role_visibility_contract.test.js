'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase636: role visibility keeps settings for all and developer nav for developer only', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(html.includes('id="nav-open-settings"'));
  assert.ok(!html.includes('id="nav-open-settings" data-role='));
  assert.ok(html.includes('<div class="nav-group nav-group-developer" data-role="developer">'));

  assert.ok(css.includes('.app-shell[data-role="operator"] [data-role="developer"],'));
  assert.ok(css.includes('.app-shell[data-role="admin"] [data-role="developer"]'));
  assert.ok(css.includes('display: none !important;'));
});

