'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: data workspace panes keep primary list-detail surfaces outside support details', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');

  assert.ok(html.includes('id="read-model-workspace-grid"') || html.includes('class="data-workspace-grid read-model-workspace-grid"'));
  assert.ok(html.includes('id="city-pack-pane-details"'));
  assert.ok(html.includes('id="vendors-pane-details"'));
  assert.ok(html.includes('id="read-model-pane-details"'));

  assert.ok(html.includes('class="data-workspace-grid city-pack-workspace-grid"'));
  assert.ok(html.includes('class="data-workspace-grid vendors-workspace-grid"'));
  assert.ok(html.includes('class="data-workspace-grid read-model-workspace-grid"'));

  assert.ok(html.includes('id="city-pack-pane-details" class="decision-details section data-workspace-secondary"'));
  assert.ok(html.includes('id="vendors-pane-details" class="decision-details section data-workspace-secondary"'));
  assert.ok(html.includes('id="read-model-pane-details" class="decision-details section data-workspace-secondary"'));
  assert.ok(html.includes('data-workbench-collapsible="true"'));
  assert.ok(html.includes('data-detail-rail="detail"'));
  assert.ok(html.includes('data-detail-rail="relation"'));

  assert.ok(css.includes('.data-workspace-grid'));
  assert.ok(css.includes('.data-workspace-secondary'));
  assert.ok(css.includes('#pane-read-model .read-model-legacy'));
  assert.ok(css.includes('#pane-city-pack .city-pack-legacy-block'));
  assert.ok(css.includes('#pane-vendors .vendors-legacy-block'));

  assert.ok(js.includes("document.getElementById('vendors-pane-details')"));
  assert.ok(dict.includes('"ui.label.readModel.secondaryWorkspace"'));
  assert.ok(dict.includes('"ui.label.cityPack.secondaryWorkspace"'));
  assert.ok(dict.includes('"ui.label.vendors.secondaryWorkspace"'));
});
