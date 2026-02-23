'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { dictionaryCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase635: domain dictionary resolves scenario/step/status/category/type labels in Japanese', () => {
  assert.equal(dictionaryCore.resolveDomainLabel('scenario', 'A'), 'A単身');
  assert.equal(dictionaryCore.resolveDomainLabel('step', '3mo'), '3か月前');
  assert.equal(dictionaryCore.resolveDomainLabel('status', 'draft'), '下書き');
  assert.equal(dictionaryCore.resolveDomainLabel('category', 'IMMEDIATE_ACTION'), '即時対応');
  assert.equal(dictionaryCore.resolveDomainLabel('type', 'VENDOR'), 'ベンダー');
});

test('phase635: dictionary keeps unknown key as-is', () => {
  assert.equal(dictionaryCore.resolveDomainLabel('scenario', 'Z'), 'Z');
});
