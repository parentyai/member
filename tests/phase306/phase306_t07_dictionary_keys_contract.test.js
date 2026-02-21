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

test('phase306: city pack request/feedback dictionary keys exist', () => {
  const dictDoc = readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const dictMap = parseDictionaryMap(dictDoc);
  const keys = new Set(Object.keys(dictMap));

  const required = [
    'ui.label.cityPack.request.col.stage',
    'ui.label.cityPack.request.col.warningCount',
    'ui.label.cityPack.request.col.agingHours',
    'ui.label.cityPack.feedback.col.slot',
    'ui.label.cityPack.feedback.col.resolution',
    'ui.label.cityPack.feedback.action.triage',
    'ui.label.cityPack.feedback.action.resolve',
    'ui.value.cityPack.feedbackStatus.new',
    'ui.value.cityPack.feedbackStatus.triaged',
    'ui.value.cityPack.feedbackStatus.resolved',
    'ui.prompt.cityPack.feedbackResolution'
  ];
  const missing = required.filter((key) => !keys.has(key));
  assert.deepStrictEqual(missing, [], `Missing keys: ${missing.join(', ')}`);
});
