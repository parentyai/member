'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase232: /admin/app includes FAQ block UX panel elements', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('id="llm-faq-block"'));
  assert.ok(html.includes('id="llm-faq-block-reason"'));
  assert.ok(html.includes('id="llm-faq-block-actions"'));
  assert.ok(html.includes('id="llm-faq-block-suggested"'));
});

test('phase232: /admin/master includes FAQ block UX panel elements', () => {
  const html = readFileSync('apps/admin/master.html', 'utf8');
  assert.ok(html.includes('id="llm-faq-block"'));
  assert.ok(html.includes('id="llm-faq-block-reason"'));
  assert.ok(html.includes('id="llm-faq-block-actions"'));
  assert.ok(html.includes('id="llm-faq-block-suggested"'));
});

test('phase232: admin app dictionary has block UX keys', () => {
  const dictDoc = readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  assert.ok(dictDoc.includes('"ui.label.llm.block.title"'));
  assert.ok(dictDoc.includes('"ui.label.llm.block.reason.NO_KB_MATCH"'));
  assert.ok(dictDoc.includes('"ui.desc.llm.block.noActions"'));
});
