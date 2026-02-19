'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase274: admin_app wires template library load and import/export actions', () => {
  const file = readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.match(file, /function loadCityPackTemplateLibrary\(/);
  assert.match(file, /function runCityPackTemplateExport\(/);
  assert.match(file, /function runCityPackTemplateImportDryRun\(/);
  assert.match(file, /function runCityPackTemplateImportApply\(/);
  assert.match(file, /\/api\/admin\/city-pack-template-library/);
  assert.match(file, /\/api\/admin\/city-packs\/import\/dry-run/);
  assert.match(file, /\/api\/admin\/city-packs\/import\/apply/);
});
