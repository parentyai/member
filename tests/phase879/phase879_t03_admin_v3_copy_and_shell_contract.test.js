'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  loadAdminUiDictionaryMap,
  assertDictionaryHasTextKeys,
} = require('../_admin_ui_dictionary_test_helper');

test('phase879: runtime and docs fix shell context, copy policy, and ops-first noise control', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const dictMap = loadAdminUiDictionaryMap();
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');

  assert.ok(js.includes('function updateAdminV3ShellChrome()'));
  assert.ok(js.includes('function setupAdminV3ShellControls()'));
  assert.ok(js.includes('function isNavItemVisibleForCurrentShell(element)'));
  assert.ok(js.includes('const V3_PANE_HEADER_MAP = Object.freeze({'));
  assert.ok(js.includes('state.uiShell = resolveUiShellForPane(nextPane, state.uiShell);'));
  assert.ok(js.includes("showToast(t('ui.toast.v3.searchNotFound', '一致する画面が見つかりませんでした'), 'warn');"));

  assert.ok(css.includes('.app-shell.admin-v3-shell-active[data-ui-shell="ops"] #managed-action-evidence'));
  assert.ok(css.includes('.app-shell.admin-v3-shell-active[data-ui-shell="ops"] #admin-local-preflight-banner'));
  assert.ok(css.includes('.app-shell.admin-v3-shell-active .page-shell-badge'));

  assertDictionaryHasTextKeys(dictMap, [
    'ui.label.llm.runOpsExplain',
    'ui.label.llm.openAudit',
    'ui.label.v3.shell.ops',
    'ui.label.v3.nav.group.today',
    'ui.desc.v3.page.home',
    'ui.desc.v3.page.alerts',
    'ui.label.v3.task.audit',
  ]);

  assert.ok(ssot.includes('## Admin UI v3 Shell Split（Phase879 add-only）'));
  assert.ok(ssot.includes('`ENABLE_ADMIN_OPS_UI_V3`（既定: 1）'));
  assert.ok(ssot.includes('`ENABLE_ADMIN_V3_KILL_SWITCH=1` で旧 shell へ即時復帰'));
});
