'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase210: master ui includes llm faq validation section', () => {
  const file = path.resolve('apps/admin/master.html');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /LLM FAQ 検証（管理者）/);
  assert.match(text, /id="llm-faq-question"/);
  assert.match(text, /id="llm-faq-locale"/);
  assert.match(text, /id="llm-faq-intent"/);
  assert.match(text, /id="llm-faq-answer"/);
  assert.match(text, /id="llm-faq-result"/);
});

test('phase210: master ui wires admin llm faq endpoint', () => {
  const file = path.resolve('apps/admin/master.html');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /\/api\/admin\/llm\/faq\/answer/);
  assert.match(text, /function generateLlmFaqAnswer\(\)/);
  assert.match(text, /LLM FAQ/);
});
