'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase636: control nav includes settings entry after incident links', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const groupStart = html.indexOf('class="nav-group nav-group-control"');
  const groupEnd = html.indexOf('class="nav-group nav-group-developer"', groupStart);
  assert.ok(groupStart >= 0 && groupEnd > groupStart, 'control nav group missing');

  const control = html.slice(groupStart, groupEnd);
  assert.ok(control.includes('data-pane-target="alerts"'));
  assert.ok(control.includes('data-pane-target="errors"'));
  assert.ok(control.includes('id="nav-open-settings"'));
  assert.ok(control.includes('data-pane-target="settings"'));
  assert.ok(control.indexOf('data-pane-target="errors"') < control.indexOf('id="nav-open-settings"'));
});
