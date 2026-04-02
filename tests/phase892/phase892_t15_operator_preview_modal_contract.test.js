'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase892: operator terminal actions are routed through the shared preview modal', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="operator-preview-modal"'));
  assert.ok(html.includes('id="operator-preview-current"'));
  assert.ok(html.includes('id="operator-preview-next"'));
  assert.ok(html.includes('id="operator-preview-changes"'));
  assert.ok(html.includes('id="operator-preview-meta"'));
  assert.ok(html.includes('id="operator-preview-confirm"'));
  assert.ok(html.includes('id="operator-preview-cancel"'));

  assert.ok(js.includes('function openOperatorPreviewModal(input) {'));
  assert.ok(js.includes('function closeOperatorPreviewModal(options) {'));
  assert.ok(js.includes('function renderOperatorPreviewEntries(elementId, entries, fallbackValue) {'));
  assert.ok(js.includes("current: '現在登録されている内容'"));
  assert.ok(js.includes("next: '実行後の状態'"));
  assert.ok(js.includes("changes: '変更される項目'"));
  assert.ok(js.includes("{ label: '影響件数', value: '1件' }"));
  assert.ok(js.includes("{ label: '完了後に移動する画面', value: 'FAQ' }"));

  [
    'buildFaqPreview(',
    'buildCityPackOperatorPreview(',
    'buildComposerActionPreview(',
    'approveEmergencyBulletinAction(',
    'rejectEmergencyBulletinAction(',
  ].forEach((snippet) => assert.ok(js.includes(snippet), `missing preview source: ${snippet}`));
});
