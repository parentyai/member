'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase211: master ui includes llm ops explain / next actions section', () => {
  const file = path.resolve('apps/admin/master.html');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /LLM Ops説明 \/ 次アクション候補（管理者）/);
  assert.match(text, /id="llm-ops-line-user-id"/);
  assert.match(text, /id="llm-ops-explain"/);
  assert.match(text, /id="llm-next-actions"/);
  assert.match(text, /id="llm-ops-explain-result"/);
  assert.match(text, /id="llm-next-actions-result"/);
});

test('phase211: master ui wires llm ops endpoints', () => {
  const file = path.resolve('apps/admin/master.html');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /\/api\/phaseLLM2\/ops-explain/);
  assert.match(text, /\/api\/phaseLLM3\/ops-next-actions/);
  assert.match(text, /function fetchLlmOpsExplain\(\)/);
  assert.match(text, /function fetchLlmNextActions\(\)/);
});
