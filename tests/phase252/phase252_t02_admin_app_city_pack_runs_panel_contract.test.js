'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase252: admin app includes city pack run history panel and controls', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="city-pack-runs-reload"'));
  assert.ok(html.includes('id="city-pack-runs-summary"'));
  assert.ok(html.includes('id="city-pack-run-rows"'));
  assert.ok(html.includes('data-dict-key="ui.label.cityPack.runs"'));

  assert.ok(js.includes('/api/admin/city-pack-source-audit/runs?limit=20'));
  assert.ok(js.includes('renderCityPackRunRows'));
  assert.ok(js.includes('city-pack-runs-reload'));
});

