'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  loadAdminUiDictionaryMap,
  assertDictionaryHasTextKeys,
} = require('../_admin_ui_dictionary_test_helper');

test('phase879: app shell adds ops ui v3 and system console chrome without changing legacy nav contracts', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const dictMap = loadAdminUiDictionaryMap();

  assert.ok(html.includes('id="v3-shell-switch-ops"'));
  assert.ok(html.includes('id="v3-shell-switch-system"'));
  assert.ok(html.includes('id="v3-pane-search-form"'));
  assert.ok(html.includes('id="v3-pane-search"'));
  assert.ok(html.includes('id="v3-open-alerts"'));
  assert.ok(html.includes('id="page-shell-badge"'));

  assert.ok(html.includes('data-v3-nav-group="today" data-ui-shell-context="ops"'));
  assert.ok(html.includes('data-v3-nav-group="messages" data-ui-shell-context="ops"'));
  assert.ok(html.includes('data-v3-nav-group="members" data-ui-shell-context="ops"'));
  assert.ok(html.includes('data-v3-nav-group="regional-ops" data-ui-shell-context="ops"'));
  assert.ok(html.includes('data-v3-nav-group="recovery" data-ui-shell-context="ops"'));
  assert.ok(html.includes('data-v3-nav-group="system-console" data-ui-shell-context="system"'));

  assert.ok(html.includes('data-dict-key="ui.label.v3.nav.group.today"'));
  assert.ok(html.includes('data-dict-key="ui.label.v3.nav.group.systemConsole"'));
  assert.ok(html.includes('data-dict-key="ui.label.v3.nav.composer"'));
  assert.ok(html.includes('data-dict-key="ui.label.v3.nav.audit"'));

  assertDictionaryHasTextKeys(dictMap, [
    'ui.label.v3.shell.ops',
    'ui.label.v3.shell.system',
    'ui.label.v3.nav.group.today',
    'ui.label.v3.nav.group.systemConsole',
    'ui.label.v3.nav.composer',
    'ui.label.v3.nav.audit',
  ]);

  assert.ok(!html.includes('data-nav-group="today"'));
  assert.ok(!html.includes('data-nav-group="messages"'));
  assert.ok(!html.includes('data-nav-group="system-console"'));
});
