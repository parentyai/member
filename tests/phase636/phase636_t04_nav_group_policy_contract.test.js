'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase636: nav group visibility policy keeps operations hidden while catalog stays visible', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(css.includes('.app-nav .nav-group:not(.nav-group-dashboard):not(.nav-group-notifications):not(.nav-group-users):not(.nav-group-catalog):not(.nav-group-developer)'));
  assert.ok(html.includes('class="nav-group nav-group-operations"'));
  assert.ok(html.includes('class="nav-group nav-group-catalog"'));
  assert.ok(html.includes('class="nav-group nav-group-notifications"'));
  assert.ok(html.includes('class="nav-group nav-group-users"'));
  assert.ok(html.includes('id="nav-open-settings"'));
});

