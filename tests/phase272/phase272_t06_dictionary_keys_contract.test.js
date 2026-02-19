'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

const DICT_START = '<!-- ADMIN_UI_DICT_BEGIN -->';
const DICT_END = '<!-- ADMIN_UI_DICT_END -->';

function parseDictionaryMap(markdown) {
  const startIdx = markdown.indexOf(DICT_START);
  const endIdx = markdown.indexOf(DICT_END);
  assert.ok(startIdx >= 0, 'ADMIN_UI_DICT_BEGIN not found');
  assert.ok(endIdx > startIdx, 'ADMIN_UI_DICT_END not found');
  const jsonText = markdown.slice(startIdx + DICT_START.length, endIdx).trim();
  return JSON.parse(jsonText);
}

test('phase272: composer type-driven dictionary keys exist', () => {
  const dictDoc = readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const dictMap = parseDictionaryMap(dictDoc);
  const keys = new Set(Object.keys(dictMap));

  const required = [
    'ui.label.composer.type',
    'ui.label.composer.livePreview',
    'ui.label.composer.saved',
    'ui.label.composer.saved.duplicate',
    'ui.label.composer.saved.col.title',
    'ui.label.composer.saved.col.actions',
    'ui.confirm.composer.approve',
    'ui.confirm.composer.execute',
    'ui.toast.composer.needRequired',
    'ui.toast.composer.needVendorId'
  ];

  const missing = required.filter((key) => !keys.has(key));
  assert.deepStrictEqual(missing, [], `Missing keys: ${missing.join(', ')}`);
});
