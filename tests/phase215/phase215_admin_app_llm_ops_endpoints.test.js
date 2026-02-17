'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase215: admin app uses admin llm ops endpoints with legacy fallback', () => {
  const file = path.resolve('apps/admin/assets/admin_app.js');
  const text = fs.readFileSync(file, 'utf8');

  assert.match(text, /function fetchJsonWithFallback\(/);
  assert.match(text, /\/api\/admin\/llm\/ops-explain/);
  assert.match(text, /\/api\/admin\/llm\/next-actions/);
  assert.match(text, /\/api\/phaseLLM2\/ops-explain/);
  assert.match(text, /\/api\/phaseLLM3\/ops-next-actions/);
});
