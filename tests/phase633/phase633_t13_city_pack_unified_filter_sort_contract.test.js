'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase633: city pack unified list applies AND filter then typed sort', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes('const CITY_PACK_UNIFIED_SORT_TYPES = Object.freeze({'));
  assert.ok(js.includes('function sortCityPackUnifiedItems(items)'));
  assert.ok(js.includes('function applyCityPackUnifiedFilters()'));
  assert.ok(js.includes('state.cityPackUnifiedFilteredItems = sortCityPackUnifiedItems(filtered);'));
  assert.ok(js.includes('if (idKeyword && !itemId.includes(idKeyword)) return false;'));
  assert.ok(js.includes('if (userKeyword && !lineUserId.includes(userKeyword)) return false;'));
  assert.ok(js.includes('if (cityKeyword && !cityLabel.includes(cityKeyword)) return false;'));
  assert.ok(js.includes('if (status && itemStatus !== status) return false;'));
  assert.ok(js.includes('if (recordType && itemType !== recordType) return false;'));
  assert.ok(js.includes('if (createdFromMs && (!createdAtMs || createdAtMs < createdFromMs)) return false;'));
  assert.ok(js.includes('if (createdToMs && (!createdAtMs || createdAtMs > createdToMs)) return false;'));
  assert.ok(js.includes("document.querySelectorAll('[data-city-pack-sort-key]')"));
  assert.ok(js.includes("document.getElementById('city-pack-unified-reload')"));
  assert.ok(js.includes('void loadCityPackRequests({ notify: false });'));
  assert.ok(js.includes('void loadCityPackFeedback({ notify: false });'));
  assert.ok(js.includes('void loadCityPackReviewInbox({ notify: true });'));
});
