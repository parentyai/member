'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase633: city pack ui v2 operator surface contract is wired (boot/html/js)', () => {
  const indexSrc = fs.readFileSync('src/index.js', 'utf8');
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(indexSrc.includes("resolveBooleanEnvFlag('ENABLE_CITY_PACK_UI_V2', true)"));
  assert.ok(indexSrc.includes('window.ENABLE_CITY_PACK_UI_V2='));

  [
    'city-pack-v2-toolbar',
    'city-pack-v2-view-needs-review',
    'city-pack-v2-view-blocked',
    'city-pack-v2-view-draft',
    'city-pack-v2-view-all',
    'city-pack-v2-detail-panel',
    'city-pack-v2-detail-actions',
    'city-pack-v2-detail-json'
  ].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`));
  });

  assert.ok(js.includes('const ADMIN_CITY_PACK_UI_V2 = resolveFrontendFeatureFlag('));
  assert.ok(js.includes('window.ENABLE_CITY_PACK_UI_V2'));
  assert.ok(js.includes('function applyCityPackUiV2Visibility()'));
  assert.ok(js.includes('function buildCityPackUnifiedActionDescriptors(item)'));
  assert.ok(js.includes("more.className = 'city-pack-action-more';"));
  assert.ok(js.includes('state.selectedCityPackUnifiedItemKey'));
});
