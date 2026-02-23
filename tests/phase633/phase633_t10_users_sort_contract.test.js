'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase633: users summary supports full-column typed sort', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  [
    'createdAt',
    'lineUserId',
    'memberNumber',
    'category',
    'status',
    'deliveryCount',
    'clickCount',
    'reactionRate'
  ].forEach((key) => {
    assert.ok(html.includes(`data-users-sort-key="${key}"`));
  });

  assert.ok(js.includes('const USERS_SUMMARY_SORT_TYPES = Object.freeze({'));
  assert.ok(js.includes('function sortUsersSummaryItems(items)'));
  assert.ok(js.includes('state.usersSummaryFilteredItems = sortUsersSummaryItems(filtered);'));
  assert.ok(js.includes('compareSortValue('));
});
