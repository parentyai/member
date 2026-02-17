'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase213: admin app includes llm config controls in llm pane', () => {
  const file = path.resolve('apps/admin/app.html');
  const text = fs.readFileSync(file, 'utf8');

  assert.match(text, /id="llm-config-enabled"/);
  assert.match(text, /id="llm-config-reload"/);
  assert.match(text, /id="llm-config-plan"/);
  assert.match(text, /id="llm-config-set"/);
  assert.match(text, /id="llm-config-status"/);
  assert.match(text, /id="llm-config-plan-result"/);
  assert.match(text, /id="llm-config-set-result"/);
});

test('phase213: admin app wires llm config endpoints', () => {
  const file = path.resolve('apps/admin/assets/admin_app.js');
  const text = fs.readFileSync(file, 'utf8');

  assert.match(text, /function loadLlmConfigStatus\(\)/);
  assert.match(text, /function planLlmConfig\(\)/);
  assert.match(text, /function setLlmConfig\(\)/);
  assert.match(text, /\/api\/admin\/llm\/config\/status/);
  assert.match(text, /\/api\/admin\/llm\/config\/plan/);
  assert.match(text, /\/api\/admin\/llm\/config\/set/);
});
