'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: control nav keeps developer-map shortcut developer-scoped', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const controlStart = html.indexOf('class="nav-group nav-group-control"');
  const developerStart = html.indexOf('class="nav-group nav-group-developer"', controlStart);
  assert.ok(controlStart >= 0 && developerStart > controlStart, 'nav group boundaries missing');

  const controlBlock = html.slice(controlStart, developerStart);
  assert.ok(controlBlock.includes('data-pane-target="developer-map"'));
  assert.ok(controlBlock.includes('data-role="developer"'));
  assert.ok(!controlBlock.includes('data-pane-target="developer-map" data-scroll-target="developer-map-legacy" data-role="admin"'));
});
