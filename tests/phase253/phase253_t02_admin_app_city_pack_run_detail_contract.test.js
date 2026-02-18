'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase253: admin app includes city pack trace button and run detail fetch', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="city-pack-open-trace"'));
  assert.ok(js.includes('loadCityPackAuditRunDetail'));
  assert.ok(js.includes('/api/admin/city-pack-source-audit/runs/'));
  assert.ok(js.includes('city-pack-open-trace'));
});

