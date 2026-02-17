'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase217: ops_readonly uses admin llm ops endpoints first', () => {
  const file = path.resolve('apps/admin/ops_readonly.html');
  const text = fs.readFileSync(file, 'utf8');

  assert.match(text, /function fetchJsonWithFallback\(/);
  assert.match(text, /\/api\/admin\/llm\/ops-explain/);
  assert.match(text, /\/api\/admin\/llm\/next-actions/);
});

test('phase217: ops_readonly keeps legacy llm ops fallback endpoints', () => {
  const file = path.resolve('apps/admin/ops_readonly.html');
  const text = fs.readFileSync(file, 'utf8');

  assert.match(text, /\/api\/phaseLLM2\/ops-explain/);
  assert.match(text, /\/api\/phaseLLM3\/ops-next-actions/);
});
