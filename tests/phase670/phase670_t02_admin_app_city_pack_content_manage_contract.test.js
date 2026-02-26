'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase670: admin app includes city pack content manage panel and endpoint wiring', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  [
    'city-pack-manage-city',
    'city-pack-manage-refresh',
    'city-pack-manage-pack-list',
    'city-pack-manage-name',
    'city-pack-manage-region-key',
    'city-pack-manage-pack-class',
    'city-pack-manage-language',
    'city-pack-manage-source-refs',
    'city-pack-manage-slot-rows',
    'city-pack-manage-create-manual',
    'city-pack-manage-create-auto',
    'city-pack-manage-save',
    'city-pack-manage-retire'
  ].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`));
  });

  assert.ok(js.includes('CITY_PACK_MANAGE_SLOT_KEYS'));
  assert.ok(js.includes('runCityPackManageCreateManual'));
  assert.ok(js.includes('runCityPackManageCreateAuto'));
  assert.ok(js.includes('runCityPackManageSave'));
  assert.ok(js.includes('runCityPackManageRetire'));
  assert.ok(js.includes('/api/admin/city-packs/${encodeURIComponent(targetPackId)}/content'));
  assert.ok(js.includes('/api/admin/city-packs/${encodeURIComponent(selectedPack.id)}/retire'));
  assert.ok(js.includes("selectedStatus !== 'draft'"));
});
