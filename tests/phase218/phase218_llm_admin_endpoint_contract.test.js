'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(path.resolve(filePath), 'utf8');
}

test('phase218: admin_app uses admin LLM endpoints first with legacy fallback', () => {
  const text = read('apps/admin/assets/admin_app.js');
  assert.match(text, /\/api\/admin\/llm\/ops-explain/);
  assert.match(text, /\/api\/phaseLLM2\/ops-explain/);
  assert.match(text, /\/api\/admin\/llm\/next-actions/);
  assert.match(text, /\/api\/phaseLLM3\/ops-next-actions/);
  assert.match(text, /fetchJsonWithFallback\(/);
});

test('phase218: master uses admin LLM endpoints first with legacy fallback', () => {
  const text = read('apps/admin/master.html');
  assert.match(text, /\/api\/admin\/llm\/ops-explain/);
  assert.match(text, /\/api\/phaseLLM2\/ops-explain/);
  assert.match(text, /\/api\/admin\/llm\/next-actions/);
  assert.match(text, /\/api\/phaseLLM3\/ops-next-actions/);
  assert.match(text, /fetchJsonWithFallback\(/);
});

test('phase218: ops_readonly uses admin LLM endpoints first with legacy fallback', () => {
  const text = read('apps/admin/ops_readonly.html');
  assert.match(text, /\/api\/admin\/llm\/ops-explain/);
  assert.match(text, /\/api\/phaseLLM2\/ops-explain/);
  assert.match(text, /\/api\/admin\/llm\/next-actions/);
  assert.match(text, /\/api\/phaseLLM3\/ops-next-actions/);
  assert.match(text, /fetchJsonWithFallback\(/);
});
