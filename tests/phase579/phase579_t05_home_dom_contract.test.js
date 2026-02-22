'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase579: home pane includes topbar summary line, alerts pane, and hidden consult button', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('id="topbar-registered-count"'));
  assert.ok(html.includes('id="topbar-scheduled-count"'));
  assert.ok(html.includes('id="topbar-open-alerts"'));
  assert.ok(html.includes('id="pane-alerts"'));
  assert.ok(html.includes('id="alerts-rows"'));
  assert.ok(html.includes('id="header-consult-link" type="button" class="secondary-btn hidden"'));
});
