'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase274: index wires city pack import/export + template library endpoints', () => {
  const file = readFileSync('src/index.js', 'utf8');
  assert.ok(file.includes("/^\\/api\\/admin\\/city-packs\\/[^/]+\\/export$/.test(pathname)"));
  assert.ok(file.includes("/^\\/api\\/admin\\/city-packs\\/import\\/(dry-run|apply)$/.test(pathname)"));
  assert.match(file, /pathname === '\/api\/admin\/city-pack-template-library'/);
  assert.match(file, /handleCityPackTemplateLibrary/);
});
