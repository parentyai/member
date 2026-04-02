'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  loadAdminUiDictionaryMap,
  assertDictionaryHasTextKeys,
} = require('../_admin_ui_dictionary_test_helper');

test('phase674: v2 navigation uses job-oriented labels and topbar stays passive', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const dictMap = loadAdminUiDictionaryMap();

  assert.ok(html.includes('data-dict-key="ui.label.nav.group.decision"'));
  assert.ok(html.includes('data-dict-key="ui.label.nav.group.workbench"'));
  assert.ok(html.includes('data-dict-key="ui.label.nav.group.dataEvidenceSystem"'));
  assert.ok(html.includes('data-dict-key="ui.label.nav.layer.evidence"'));
  assert.ok(html.includes('data-dict-key="ui.label.nav.layer.system"'));
  assert.ok(html.includes('data-dict-key="ui.label.nav.layer.llm"'));

  assert.ok(html.includes('data-ui-topbar-mode="passive"'));
  assert.ok(html.includes('class="top-summary-line is-hidden-by-flag" aria-hidden="true"'));
  assert.ok(html.includes('class="top-passive-line" data-dict-key="ui.label.top.passiveGuide"'));

  assert.ok(js.includes("const forcePassiveTopbar = appShell?.getAttribute('data-ui-v2-foundation') === 'true';"));
  assert.ok(js.includes("if (ADMIN_TOP_SUMMARY_V1 && !forcePassiveTopbar) {"));
  assert.ok(js.includes("document.querySelectorAll('.top-developer').forEach((el) => {"));
  assert.ok(js.includes("el.classList.add('hidden');"));

  assertDictionaryHasTextKeys(dictMap, [
    'ui.label.nav.group.decision',
    'ui.label.nav.group.workbench',
    'ui.label.nav.group.dataEvidenceSystem',
    'ui.label.nav.layer.evidence',
    'ui.label.nav.layer.system',
    'ui.label.nav.layer.llm',
    'ui.label.top.passiveGuide',
  ]);
});
