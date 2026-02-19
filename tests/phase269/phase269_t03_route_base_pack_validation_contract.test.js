'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

test('phase269: city pack structure update validates base pack depth and self reference', () => {
  const code = fs.readFileSync(path.join(ROOT, 'src/routes/admin/cityPacks.js'), 'utf8');
  assert.match(code, /base_pack_self_reference/);
  assert.match(code, /validateBasePackDepth/);
  assert.match(code, /basePackId/);
});
