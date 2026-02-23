'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase634: default sort keys align with trend UI plan', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes("composerSavedSortKey: 'createdAt'"));
  assert.ok(js.includes("usersSummarySortKey: 'createdAt'"));
  assert.ok(js.includes("cityPackUnifiedSortKey: 'updatedAt'"));
  assert.ok(js.includes("vendorSortKey: 'updatedAt'"));
  assert.ok(js.includes("state.vendorSortKey = 'createdAt'"));
});
