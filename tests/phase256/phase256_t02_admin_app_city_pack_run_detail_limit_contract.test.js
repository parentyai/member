'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase256: admin app includes run detail limit input and query wiring', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="city-pack-run-detail-limit"'));
  assert.ok(js.includes('getCityPackRunDetailLimit'));
  assert.ok(js.includes('URLSearchParams({ limit: String(limit) })'));
});
