'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase633: city pack pane includes unified filter + sortable table columns', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

  [
    'city-pack-unified-filter-id',
    'city-pack-unified-filter-user-id',
    'city-pack-unified-filter-city',
    'city-pack-unified-filter-status',
    'city-pack-unified-filter-type',
    'city-pack-unified-filter-date-from',
    'city-pack-unified-filter-date-to',
    'city-pack-unified-reload',
    'city-pack-unified-rows'
  ].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`));
  });

  [
    'createdAt',
    'itemId',
    'lineUserId',
    'cityLabel',
    'recordType',
    'status',
    'assignee',
    'updatedAt',
    'kpiScore'
  ].forEach((key) => {
    assert.ok(html.includes(`data-city-pack-sort-key="${key}"`));
  });
});
