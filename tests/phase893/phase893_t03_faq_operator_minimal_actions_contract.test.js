'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase893: faq operator surface keeps registration primary and hides destructive actions until an article is selected', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(!html.includes('id="faq-reload"'), 'faq reload button should be removed from first-view');
  assert.ok(html.includes('id="faq-create-new"'), 'faq create button missing');
  assert.ok(html.includes('id="faq-save-article"'), 'faq save button missing');
  assert.ok(html.includes('id="faq-stop-article" type="button" class="secondary-btn" hidden disabled aria-hidden="true"'), 'faq stop button should start hidden for new article flow');
  assert.ok(html.includes('id="faq-delete-article" type="button" class="secondary-btn" hidden disabled aria-hidden="true"'), 'faq delete button should start hidden for new article flow');
  assert.ok(js.includes('function syncFaqOperatorActionVisibility(article) {'), 'faq action visibility helper missing');
  assert.ok(js.includes("btn.hidden = !isExisting;"), 'faq destructive actions should hide for new article flow');
  assert.ok(js.includes("saveBtn.textContent = isExisting ? '登録内容を保存する' : '新しい質問を登録する';"), 'faq primary action label should adapt to new vs existing article');
  assert.ok(css.includes('#pane-llm #faq-selection-summary'), 'faq selection summary should stay hidden in ops shell');
  assert.ok(css.includes('#pane-llm #faq-stop-article[hidden]'), 'faq destructive actions should stay visually hidden when not applicable');
  assert.ok(css.includes('#pane-llm #faq-create-new'), 'ops shell should suppress duplicate FAQ create buttons inside the body');
});
