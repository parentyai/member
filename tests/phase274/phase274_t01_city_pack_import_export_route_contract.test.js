'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('phase274: city pack route supports export + import dry-run/apply with confirm token', () => {
  const file = readFileSync('src/routes/admin/cityPacks.js', 'utf8');
  assert.match(file, /parseCityPackExport/);
  assert.match(file, /parseImportPath/);
  assert.match(file, /createConfirmToken/);
  assert.match(file, /verifyConfirmToken/);
  assert.match(file, /city_pack\.template\.import_dry_run/);
  assert.match(file, /city_pack\.template\.import_apply/);
});

test('phase274: city pack import normalization keeps normalized modules/recommendedTasks as SSOT', () => {
  const file = readFileSync('src/routes/admin/cityPacks.js', 'utf8');
  assert.match(file, /modules: cityPacksRepo\.normalizeModules\(template\.modules\)/);
  assert.match(file, /recommendedTasks: cityPacksRepo\.normalizeRecommendedTasks\(template\.recommendedTasks\)/);
  assert.doesNotMatch(file, /modules: Array\.isArray\(template\.modules\) \? template\.modules : \[\]/);
  assert.doesNotMatch(file, /recommendedTasks: Array\.isArray\(template\.recommendedTasks\) \? template\.recommendedTasks : \[\]/);
  assert.strictEqual(countOccurrences(file, 'modules: payload.modules'), 1);
  assert.strictEqual(countOccurrences(file, 'recommendedTasks: payload.recommendedTasks'), 1);
  assert.strictEqual(countOccurrences(file, 'modules: Array.isArray(cityPack.modules) ? cityPack.modules : []'), 1);
  assert.strictEqual(countOccurrences(file, 'recommendedTasks: Array.isArray(cityPack.recommendedTasks) ? cityPack.recommendedTasks : []'), 1);
});
