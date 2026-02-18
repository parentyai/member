'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

const REQUIRED_KEYS = [
  'ui.desc.cityPack.runDetail.empty',
  'ui.desc.cityPack.runDetail.noEvidence',
  'ui.label.cityPack.runDetail.raw',
  'ui.label.cityPack.runDetail.col.evidence',
  'ui.label.cityPack.runDetail.col.result',
  'ui.label.cityPack.runDetail.col.checkedAt',
  'ui.label.cityPack.runDetail.col.statusCode',
  'ui.label.cityPack.runDetail.col.action',
  'ui.label.cityPack.runDetail.openEvidence',
  'ui.toast.cityPack.traceMissing'
];

test('phase254: city pack run detail dictionary keys are defined', () => {
  const dict = readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');

  REQUIRED_KEYS.forEach((key) => {
    assert.ok(dict.includes(`"${key}"`), `missing dict key: ${key}`);
  });
});
