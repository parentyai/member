'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase635: topbar keeps role switch only (no developer menu buttons)', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const start = html.indexOf('<header class="app-topbar"');
  const end = html.indexOf('</header>', start);
  assert.ok(start >= 0 && end > start, 'topbar header block missing');
  const topbar = html.slice(start, end);

  assert.ok(topbar.includes('role-switch'), 'role switch missing');
  assert.ok(!topbar.includes('developer-open-map'));
  assert.ok(!topbar.includes('developer-open-manual-user'));
  assert.ok(!topbar.includes('developer-open-manual-redac'));

  // Developer actions still exist (relocated to the left nav).
  assert.ok(html.includes('nav-group-developer'));
  assert.ok(html.includes('id="developer-open-map"'));
  assert.ok(html.includes('id="developer-open-system"'));
  assert.ok(html.includes('id="developer-open-audit"'));
  assert.ok(html.includes('id="developer-open-implementation"'));
  assert.ok(html.includes('id="developer-open-legacy"'));
  assert.ok(html.includes('id="developer-open-manual-redac"'));
  assert.ok(html.includes('id="developer-open-manual-user"'));
});

