'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase256: dictionary includes city pack run detail limit keys', () => {
  const dict = readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  assert.ok(dict.includes('"ui.label.cityPack.runDetail.limit"'));
  assert.ok(dict.includes('"ui.help.cityPack.runDetail.limit"'));
});
