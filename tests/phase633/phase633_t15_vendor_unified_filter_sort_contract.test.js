'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase633: vendor unified list applies AND filter then typed sort', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes('const VENDOR_UNIFIED_SORT_TYPES = Object.freeze({'));
  assert.ok(js.includes('function sortVendorItems(items)'));
  assert.ok(js.includes('function applyVendorUnifiedFilters()'));
  assert.ok(js.includes('state.vendorUnifiedFilteredItems = sortVendorItems(filtered);'));
  assert.ok(js.includes('if (idKeyword && !linkId.includes(idKeyword)) return false;'));
  assert.ok(js.includes('if (nameKeyword && !vendorLabel.includes(nameKeyword)) return false;'));
  assert.ok(js.includes('if (status && rowStatus !== status) return false;'));
  assert.ok(js.includes('if (categoryKeyword && !category.includes(categoryKeyword)) return false;'));
  assert.ok(js.includes('if (createdFromMs && (!createdAtMs || createdAtMs < createdFromMs)) return false;'));
  assert.ok(js.includes('if (createdToMs && (!createdAtMs || createdAtMs > createdToMs)) return false;'));
  assert.ok(js.includes("document.querySelectorAll('[data-vendor-sort-key]')"));
  assert.ok(js.includes("document.getElementById('vendor-unified-filter-status')"));
  assert.ok(js.includes("document.getElementById('vendor-unified-reload')"));
  assert.ok(js.includes("document.getElementById('vendor-unified-filter-status')?.value?.trim()"));
});
