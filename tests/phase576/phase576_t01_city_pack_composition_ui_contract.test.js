'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase576: city pack pane includes composition read-only section', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/admin/app.html'), 'utf8');
  assert.ok(html.includes('id="city-pack-composition-region-key"'));
  assert.ok(html.includes('id="city-pack-composition-language"'));
  assert.ok(html.includes('id="city-pack-composition-limit"'));
  assert.ok(html.includes('id="city-pack-composition-reload"'));
  assert.ok(html.includes('id="city-pack-composition-summary"'));
  assert.ok(html.includes('id="city-pack-composition-readiness"'));
  assert.ok(html.includes('id="city-pack-composition-fallback"'));
  assert.ok(html.includes('id="city-pack-composition-rows"'));
});

test('phase576: admin app loads composition via read-only admin endpoint', () => {
  const js = fs.readFileSync(path.join(ROOT, 'apps/admin/assets/admin_app.js'), 'utf8');
  assert.ok(js.includes('async function loadCityPackComposition(options)'));
  assert.ok(js.includes('/api/admin/city-packs/composition?'));
  assert.ok(js.includes('city-pack-composition-reload'));
  assert.ok(js.includes('renderCityPackCompositionDiagnostics'));
});
