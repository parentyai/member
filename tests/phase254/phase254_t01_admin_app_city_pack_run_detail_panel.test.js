'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase254: admin app includes city pack run detail table and raw drawer', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');

  assert.ok(html.includes('id="city-pack-run-detail-summary"'));
  assert.ok(html.includes('id="city-pack-run-detail-rows"'));
  assert.ok(html.includes('id="city-pack-run-result"'));
  assert.ok(html.includes('ui.label.cityPack.runDetail.col.evidence'));
  assert.ok(html.includes('ui.label.cityPack.runDetail.raw'));
});
