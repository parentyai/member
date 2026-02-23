'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase633: vendor pane includes unified filter + sortable table columns', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

  [
    'vendor-unified-filter-id',
    'vendor-unified-filter-name',
    'vendor-unified-filter-status',
    'vendor-unified-filter-category',
    'vendor-unified-filter-date-from',
    'vendor-unified-filter-date-to',
    'vendor-unified-reload',
    'vendor-unified-rows'
  ].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`));
  });

  [
    'createdAt',
    'linkId',
    'vendorLabel',
    'category',
    'status',
    'updatedAt',
    'relatedCount'
  ].forEach((key) => {
    assert.ok(html.includes(`data-vendor-sort-key="${key}"`));
  });
});
