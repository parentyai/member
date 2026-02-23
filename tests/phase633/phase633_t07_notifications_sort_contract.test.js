'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase633: notifications saved list applies typed sort after filter', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes('const COMPOSER_SAVED_SORT_TYPES = Object.freeze({'));
  assert.ok(js.includes('state.composerSavedFilteredItems = sortComposerSavedItems(filtered);'));
  assert.ok(js.includes("if (valueType === 'date')"));
  assert.ok(js.includes("if (valueType === 'number')"));
  assert.ok(js.includes("localeCompare(bText, 'ja'"));
  assert.ok(js.includes('if (aUnset) return 1;'));
});
