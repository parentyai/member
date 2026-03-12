'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function extractPaneSection(html, paneId) {
  const marker = `<section id="pane-${paneId}"`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const next = html.indexOf('<section id="pane-', start + marker.length);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

test('phase674: city pack and vendors expose relation-view drill-down surfaces', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const cityPackPane = extractPaneSection(html, 'city-pack');
  const vendorsPane = extractPaneSection(html, 'vendors');

  assert.ok(cityPackPane.includes('id="city-pack-unified-filter-relation"'));
  assert.ok(cityPackPane.includes('data-ui="city-pack-relation-view"'));
  assert.ok(cityPackPane.includes('id="city-pack-v2-relation-summary"'));
  assert.ok(cityPackPane.includes('id="city-pack-v2-relation-actions"'));

  assert.ok(vendorsPane.includes('id="vendor-unified-filter-relation"'));
  assert.ok(vendorsPane.includes('data-ui="vendor-relation-view"'));
  assert.ok(vendorsPane.includes('id="vendor-unified-relation-summary"'));
  assert.ok(vendorsPane.includes('id="vendor-unified-relation-actions"'));
});

test('phase674: runtime binds relation snapshot and drill-down contract on unified lists', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes('function buildCityPackUnifiedRelationSnapshot(item) {'));
  assert.ok(js.includes('function buildVendorRelationSnapshot(item) {'));
  assert.ok(js.includes('function applyCityPackUnifiedRelationFilter(options) {'));
  assert.ok(js.includes('function openVendorRelationDrillDown(linkId) {'));
  assert.ok(js.includes('function renderVendorUnifiedRelationPanel() {'));
  assert.ok(js.includes('city-pack-unified-filter-relation'));
  assert.ok(js.includes('vendor-unified-filter-relation'));
});

