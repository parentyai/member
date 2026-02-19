'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase274: city pack route supports export + import dry-run/apply with confirm token', () => {
  const file = readFileSync('src/routes/admin/cityPacks.js', 'utf8');
  assert.match(file, /parseCityPackExport/);
  assert.match(file, /parseImportPath/);
  assert.match(file, /createConfirmToken/);
  assert.match(file, /verifyConfirmToken/);
  assert.match(file, /city_pack\.template\.import_dry_run/);
  assert.match(file, /city_pack\.template\.import_apply/);
});
