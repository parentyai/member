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

function extractKeysByRegex(text, regex) {
  const set = new Set();
  let match = null;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) set.add(match[1]);
  }
  return set;
}

test('phase207: all ui.* keys used in /admin/app exist in ADMIN_UI_DICTIONARY_JA', () => {
  const dictDoc = readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const dictMap = parseDictionaryMap(dictDoc);
  const dictKeys = new Set(Object.keys(dictMap));

  const appHtml = readFileSync('apps/admin/app.html', 'utf8');
  const appJs = readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  const htmlDictKeys = extractKeysByRegex(appHtml, /data-dict-key="([^"]+)"/g);
  const htmlTipKeys = extractKeysByRegex(appHtml, /data-dict-tip="([^"]+)"/g);
  const jsKeys = extractKeysByRegex(appJs, /t\('([^']+)'/g);

  const usedUiKeys = new Set();
  [htmlDictKeys, htmlTipKeys, jsKeys].forEach((set) => {
    set.forEach((key) => {
      if (key.startsWith('ui.')) usedUiKeys.add(key);
    });
  });

  const missing = Array.from(usedUiKeys).filter((key) => !dictKeys.has(key)).sort();
  assert.deepStrictEqual(missing, [], `Missing dictionary keys: ${missing.join(', ')}`);
});
