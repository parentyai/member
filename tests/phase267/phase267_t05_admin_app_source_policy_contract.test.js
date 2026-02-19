'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

test('phase267: admin app city pack pane has source policy controls', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/admin/app.html'), 'utf8');
  assert.match(html, /id="city-pack-source-policy-save"/);
  assert.match(html, /id="city-pack-source-type"/);
  assert.match(html, /id="city-pack-required-level"/);
  assert.match(html, /ui\.label\.cityPack\.sourcePolicy/);
});

test('phase267: admin app JS posts source policy update endpoint', () => {
  const js = fs.readFileSync(path.join(ROOT, 'apps/admin/assets/admin_app.js'), 'utf8');
  assert.match(js, /\/api\/admin\/source-refs\/\$\{encodeURIComponent\(sourceRefId\)\}\/policy/);
  assert.match(js, /runCityPackSaveSourcePolicy/);
});
