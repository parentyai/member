'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

function parseJsonBlock(text, start, end) {
  const startIdx = text.indexOf(start);
  const endIdx = text.indexOf(end);
  assert.ok(startIdx >= 0 && endIdx > startIdx, 'dictionary JSON block missing');
  const jsonText = text.slice(startIdx + start.length, endIdx).trim();
  return JSON.parse(jsonText);
}

test('phase310: developer labels exist in dictionary and audit workflow checks repo-map drift', () => {
  const dictText = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const dict = parseJsonBlock(dictText, '<!-- ADMIN_UI_DICT_BEGIN -->', '<!-- ADMIN_UI_DICT_END -->');
  const requiredKeys = [
    'ui.label.developer.menu',
    'ui.label.developer.repoMap',
    'ui.label.developer.systemState',
    'ui.label.developer.audit',
    'ui.label.developer.implementation',
    'ui.label.page.developerMap',
    'ui.desc.page.developerMap',
    'ui.value.repoMap.notAvailable'
  ];
  requiredKeys.forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(dict, key), `missing dictionary key: ${key}`);
  });

  const workflow = fs.readFileSync('.github/workflows/audit.yml', 'utf8');
  assert.ok(workflow.includes('npm run repo-map:check'));
});
