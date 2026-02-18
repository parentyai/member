'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase260: admin app includes city pack request panel', () => {
  const filePath = path.resolve(__dirname, '../../apps/admin/app.html');
  const html = fs.readFileSync(filePath, 'utf8');
  assert.ok(html.includes('city-pack-request-rows'));
  assert.ok(html.includes('city-pack-request-reload'));
  assert.ok(html.includes('city-pack-request-summary'));
  assert.ok(html.includes('city-pack-request-raw'));
});
