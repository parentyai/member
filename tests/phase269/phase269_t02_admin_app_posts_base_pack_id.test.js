'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

test('phase269: admin app reads basePackId input and posts it on structure save', () => {
  const js = fs.readFileSync(path.join(ROOT, 'apps/admin/assets/admin_app.js'), 'utf8');
  assert.match(js, /city-pack-structure-base-pack-id/);
  assert.match(js, /const basePackId = document\.getElementById\('city-pack-structure-base-pack-id'\)\?\.value\?\.trim\(\) \|\| '';/);
  assert.match(js, /basePackId: basePackId \|\| null/);
});
