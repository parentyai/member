'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  loadAdminUiDictionaryMap,
  assertDictionaryHasTextKeys,
} = require('../_admin_ui_dictionary_test_helper');

test('phase636: topbar keeps role switch and stays passive', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const dictMap = loadAdminUiDictionaryMap();
  const start = html.indexOf('<header class="app-topbar"');
  const end = html.indexOf('</header>', start);
  assert.ok(start >= 0 && end > start, 'topbar header block missing');
  const topbar = html.slice(start, end);

  assert.ok(topbar.includes('data-ui-topbar-mode="passive"'), 'topbar must declare passive mode');
  assert.ok(topbar.includes('role-switch'), 'role switch missing');
  assert.ok(topbar.includes('top-developer hidden'), 'developer block must stay hidden in topbar');
  assert.ok(topbar.includes('data-dict-key="ui.label.top.passiveGuide"'), 'topbar must bind passive guidance dictionary key');
  assert.ok(!topbar.includes('id="developer-open-map"'));
  assert.ok(!topbar.includes('id="developer-open-manual-user"'));
  assert.ok(!topbar.includes('id="developer-open-manual-redac"'));
  assertDictionaryHasTextKeys(dictMap, ['ui.label.top.passiveGuide']);
});
