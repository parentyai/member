'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase209: master ui includes llm config controls', () => {
  const file = path.resolve('apps/admin/master.html');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /LLM提案機能（FAQ\/Ops\/NextAction）/);
  assert.match(text, /id="llm-config-enabled"/);
  assert.match(text, /id="llm-config-reload"/);
  assert.match(text, /id="llm-config-plan"/);
  assert.match(text, /id="llm-config-set"/);
});

test('phase209: master ui wires llm config endpoints', () => {
  const file = path.resolve('apps/admin/master.html');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /\/api\/admin\/llm\/config\/status/);
  assert.match(text, /\/api\/admin\/llm\/config\/plan/);
  assert.match(text, /\/api\/admin\/llm\/config\/set/);
  assert.match(text, /LLM設定 計画/);
  assert.match(text, /LLM設定 適用/);
});
