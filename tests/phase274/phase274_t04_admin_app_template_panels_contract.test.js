'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase274: app.html contains template library and import/export controls in city pack pane', () => {
  const file = readFileSync('apps/admin/app.html', 'utf8');
  assert.match(file, /id="city-pack-template-library-rows"/);
  assert.match(file, /id="city-pack-template-library-reload"/);
  assert.match(file, /id="city-pack-template-export-run"/);
  assert.match(file, /id="city-pack-template-library-create"/);
  assert.match(file, /id="city-pack-template-import-dry-run"/);
  assert.match(file, /id="city-pack-template-import-apply"/);
  assert.match(file, /id="city-pack-template-json"/);
});
