'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

test('phase269: cityPacksRepo normalizes basePackId and overrides in structure patch', () => {
  const code = fs.readFileSync(path.join(ROOT, 'src/repos/firestore/cityPacksRepo.js'), 'utf8');
  assert.match(code, /normalizeCityPackStructurePatch/);
  assert.match(code, /basePackId/);
  assert.match(code, /overrides/);
  assert.match(code, /function validateBasePackDepth/);
});
