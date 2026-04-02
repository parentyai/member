'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

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

function loadAdminUiDictionaryMap() {
  const dictDoc = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  return parseDictionaryMap(dictDoc);
}

function assertDictionaryHasTextKeys(dictMap, keys) {
  keys.forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(dictMap, key), `dictionary missing key: ${key}`);
    const value = dictMap[key];
    assert.equal(typeof value, 'string', `dictionary key must be text: ${key}`);
    assert.ok(value.trim().length > 0, `dictionary key must be non-empty: ${key}`);
  });
}

module.exports = {
  loadAdminUiDictionaryMap,
  assertDictionaryHasTextKeys,
};

