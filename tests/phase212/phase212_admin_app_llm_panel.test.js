'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase212: admin app includes LLM nav and pane controls', () => {
  const file = path.resolve('apps/admin/app.html');
  const text = fs.readFileSync(file, 'utf8');

  assert.match(text, /data-pane-target="llm"/);
  assert.match(text, /data-dict-key="ui\.label\.nav\.llm"/);
  assert.match(text, /id="pane-llm"/);
  assert.match(text, /id="llm-line-user-id"/);
  assert.match(text, /id="llm-faq-question"/);
  assert.match(text, /id="llm-run-ops-explain"/);
  assert.match(text, /id="llm-run-next-actions"/);
  assert.match(text, /id="llm-run-faq"/);
  assert.match(text, /id="llm-ops-explain-result"/);
  assert.match(text, /id="llm-next-actions-result"/);
  assert.match(text, /id="llm-faq-result"/);
});

test('phase212: admin app wires LLM endpoints from pane actions', () => {
  const file = path.resolve('apps/admin/assets/admin_app.js');
  const text = fs.readFileSync(file, 'utf8');

  assert.match(text, /function runLlmOpsExplain\(\)/);
  assert.match(text, /function runLlmNextActions\(\)/);
  assert.match(text, /function runLlmFaq\(\)/);
  assert.match(text, /\/api\/phaseLLM2\/ops-explain/);
  assert.match(text, /\/api\/phaseLLM3\/ops-next-actions/);
  assert.match(text, /\/api\/admin\/llm\/faq\/answer/);
  assert.match(text, /function setupLlmControls\(\)/);
});
