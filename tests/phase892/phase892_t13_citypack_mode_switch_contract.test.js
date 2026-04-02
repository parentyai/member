'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase892: city pack operator surface unifies guide and emergency modes', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="city-pack-operator-mode-guide"'));
  assert.ok(html.includes('id="city-pack-operator-mode-emergency"'));
  assert.ok(js.includes('function setCityPackOperatorMode(mode, options) {'));
  assert.ok(js.includes("'city-pack:guide': Object.freeze({"));
  assert.ok(js.includes("'city-pack:emergency': Object.freeze({"));
  assert.ok(js.includes('cityPackOperatorMode: CITY_PACK_OPERATOR_MODE.guide'));
  assert.ok(js.includes('cityPackOperatorMode: CITY_PACK_OPERATOR_MODE.emergency'));
});
