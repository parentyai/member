'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

test('phase269: city pack structure editor includes basePackId input with dict keys', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/admin/app.html'), 'utf8');
  assert.match(html, /city-pack-structure-base-pack-id/);
  assert.match(html, /ui\.label\.cityPack\.structure\.basePackId/);
  assert.match(html, /ui\.help\.cityPack\.structure\.basePackId/);
});
