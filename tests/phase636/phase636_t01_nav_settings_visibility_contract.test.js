'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase636: catalog nav includes settings entry under vendors', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const groupStart = html.indexOf('class="nav-group nav-group-catalog"');
  const groupEnd = html.indexOf('</div>', groupStart);
  assert.ok(groupStart >= 0 && groupEnd > groupStart, 'catalog nav group missing');

  const catalog = html.slice(groupStart, groupEnd);
  assert.ok(catalog.includes('data-pane-target="city-pack"'));
  assert.ok(catalog.includes('data-pane-target="vendors"'));
  assert.ok(catalog.includes('id="nav-open-settings"'));
  assert.ok(catalog.includes('data-pane-target="settings"'));
  assert.ok(catalog.indexOf('data-pane-target="vendors"') < catalog.indexOf('id="nav-open-settings"'));
});
