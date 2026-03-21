'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: v2 navigation uses job-oriented labels and topbar stays passive', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const docs = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');

  assert.ok(html.includes('data-dict-key="ui.label.nav.group.decision">今日の判断</div>'));
  assert.ok(html.includes('data-dict-key="ui.label.nav.group.workbench">通知を進める</div>'));
  assert.ok(html.includes('data-dict-key="ui.label.nav.group.dataEvidenceSystem">状態を確認する</div>'));
  assert.ok(html.includes('data-dict-key="ui.label.nav.layer.evidence">証跡を追う</div>'));
  assert.ok(html.includes('data-dict-key="ui.label.nav.layer.system">設定と回復</div>'));
  assert.ok(html.includes('data-dict-key="ui.label.nav.layer.llm">LLM運用</div>'));

  assert.ok(html.includes('data-ui-topbar-mode="passive"'));
  assert.ok(html.includes('class="top-summary-line is-hidden-by-flag" aria-hidden="true"'));
  assert.ok(html.includes('class="top-passive-line" data-dict-key="ui.label.top.passiveGuide"'));

  assert.ok(js.includes("const forcePassiveTopbar = appShell?.getAttribute('data-ui-v2-foundation') === 'true';"));
  assert.ok(js.includes("if (ADMIN_TOP_SUMMARY_V1 && !forcePassiveTopbar) {"));
  assert.ok(js.includes("document.querySelectorAll('.top-developer').forEach((el) => {"));
  assert.ok(js.includes("el.classList.add('hidden');"));

  assert.ok(docs.includes('"ui.label.nav.group.decision": "今日の判断"'));
  assert.ok(docs.includes('"ui.label.nav.layer.system": "設定と回復"'));
  assert.ok(docs.includes('"ui.label.top.passiveGuide": "移動は左ナビ、実行は各画面の主ボタンから行います。"'));
});
