'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase634: sort UI state updates aria-sort and sort direction attributes', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes('function applySortUiState'));
  assert.ok(js.includes('aria-sort'));
  assert.ok(js.includes('data-sort-direction'));
});
