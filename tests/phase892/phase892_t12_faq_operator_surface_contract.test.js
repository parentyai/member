'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase892: llm pane exposes faq operator surface without ai jargon in first view', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const faqStart = html.indexOf('id="faq-operator-surface"');
  const faqEnd = html.indexOf('<div class="pane-grid llm-workspace-grid"', faqStart);
  const faqSurface = html.slice(faqStart, faqEnd);

  assert.ok(faqSurface.includes('FAQ'));
  assert.ok(faqSurface.includes('新しい質問を登録する'));
  assert.ok(faqSurface.includes('公開を停止する'));
  assert.ok(faqSurface.includes('削除する（履歴を残す）'));
  assert.ok(faqSurface.includes('id="faq-operator-rows"'));
  assert.ok(faqSurface.includes('id="faq-save-article"'));
  assert.ok(faqSurface.includes('id="faq-stop-article"'));
  assert.ok(faqSurface.includes('id="faq-delete-article"'));
  assert.ok(!faqSurface.includes('LLM'));
  assert.ok(!faqSurface.includes('trace'));
  assert.ok(!faqSurface.includes('JSON'));

  assert.ok(js.includes('const operatorFaqMode = normalizeRoleValue(state.role) === \'operator\' && isOpsShellActive();'));
  assert.ok(js.includes('function renderFaqOperatorSurface() {'));
});
