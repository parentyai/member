'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase266: admin app includes city pack structure editor controls', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('id="city-pack-structure-targeting"'));
  assert.ok(html.includes('id="city-pack-structure-slots"'));
  assert.ok(html.includes('id="city-pack-structure-save"'));
});

test('phase266: admin app wires city pack structure save endpoint', () => {
  const script = readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(script.includes('runCityPackSaveStructure'));
  assert.ok(script.includes('/api/admin/city-packs/${encodeURIComponent(cityPackId)}/structure'));
});
