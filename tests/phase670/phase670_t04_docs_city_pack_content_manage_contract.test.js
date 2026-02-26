'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase670: docs include city pack content manage dictionary and SSOT addenda', () => {
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const ssotOs = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');
  const ssotData = fs.readFileSync('docs/SSOT_ADMIN_UI_DATA_MODEL.md', 'utf8');

  [
    'ui.label.cityPack.contentManager',
    'ui.desc.cityPack.contentManager',
    'ui.confirm.cityPack.contentManageRetire',
    'ui.toast.cityPack.contentManageSaveOk'
  ].forEach((token) => {
    assert.ok(dict.includes(token));
  });

  assert.ok(ssotOs.includes('Phase670 Add-only UI Contract（City Pack内容CRUD）'));
  assert.ok(ssotOs.includes('POST /api/admin/city-packs/:id/content'));
  assert.ok(ssotData.includes('Phase670 Add-only Data Contract（City Pack内容管理）'));
  assert.ok(ssotData.includes('POST /api/admin/city-packs/:id/content'));
});
