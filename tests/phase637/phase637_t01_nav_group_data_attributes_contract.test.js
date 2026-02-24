'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase637: nav groups declare explicit data-nav-group and data-nav-surface attributes', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

  assert.ok(html.includes('class="nav-group nav-group-dashboard" data-nav-group="dashboard" data-nav-surface="primary"'));
  assert.ok(html.includes('class="nav-group nav-group-notifications" data-nav-group="notifications" data-nav-surface="primary"'));
  assert.ok(html.includes('class="nav-group nav-group-users" data-nav-group="users" data-nav-surface="primary"'));
  assert.ok(html.includes('class="nav-group nav-group-catalog" data-nav-group="catalog" data-nav-surface="primary"'));
  assert.ok(html.includes('class="nav-group nav-group-developer" data-nav-group="developer" data-nav-surface="secondary"'));
  assert.ok(html.includes('class="nav-group nav-group-communication" data-nav-group="communication" data-nav-surface="hidden"'));
  assert.ok(html.includes('class="nav-group nav-group-operations" data-nav-group="operations" data-nav-surface="hidden"'));
});
