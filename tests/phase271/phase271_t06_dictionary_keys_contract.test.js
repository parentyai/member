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

test('phase271: bulletin/proposal dictionary keys exist', () => {
  const dictDoc = readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const dictMap = parseDictionaryMap(dictDoc);
  const keys = new Set(Object.keys(dictMap));

  const required = [
    'ui.label.cityPack.bulletinInbox',
    'ui.label.cityPack.proposalInbox',
    'ui.label.cityPack.bulletinDraft.create',
    'ui.label.cityPack.proposalDraft.create',
    'ui.toast.cityPack.bulletinCreateOk',
    'ui.toast.cityPack.proposalCreateOk',
    'ui.confirm.cityPack.bulletin.send',
    'ui.confirm.cityPack.proposal.apply'
  ];

  const missing = required.filter((key) => !keys.has(key));
  assert.deepStrictEqual(missing, [], `Missing keys: ${missing.join(', ')}`);
});
