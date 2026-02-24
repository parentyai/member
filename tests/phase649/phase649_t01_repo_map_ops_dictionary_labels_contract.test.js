'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
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

test('phase649: repo map section labels use operator wording (ops verdict, blockers, warnings, next)', () => {
  const dictDoc = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const dictMap = parseDictionaryMap(dictDoc);

  assert.equal(dictMap['ui.label.repoMap.canDo'], '運用判定');
  assert.equal(dictMap['ui.label.repoMap.cannotDo'], 'ブロッカー');
  assert.equal(dictMap['ui.label.repoMap.risks'], '注意');
  assert.equal(dictMap['ui.label.repoMap.nextActions'], '次の一手');

  assert.equal(dictMap['ui.label.repoMap.notifications.canDo'], '送信判定');
  assert.equal(dictMap['ui.label.repoMap.notifications.cannotDo'], '送信ブロッカー');
  assert.equal(dictMap['ui.label.repoMap.notifications.risks'], '注意');
  assert.equal(dictMap['ui.label.repoMap.notifications.nextActions'], '次の一手');

  assert.equal(dictMap['ui.label.manual.redac.canDo'], '運用でできること');
});

