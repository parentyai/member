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

  assert.ok(html.includes('data-v3-nav-group="operator-primary" data-ui-shell-context="ops"'));
  assert.ok(html.includes('data-v3-nav-group="system-console" data-ui-shell-context="system"'));

  const operatorNav = html.slice(
    html.indexOf('data-v3-nav-group="operator-primary"'),
    html.indexOf('data-v3-nav-group="system-console"')
  );
  const navOrder = Array.from(operatorNav.matchAll(/data-pane-target="([^"]+)"/g), (match) => match[1]);
  assert.deepEqual(navOrder.slice(0, 5), ['home', 'alerts', 'read-model', 'city-pack', 'llm']);
  ['composer', 'monitor', 'errors', 'emergency-layer', 'settings', 'audit'].forEach((paneKey) => {
    assert.ok(!operatorNav.includes(`data-pane-target="${paneKey}"`), `operator primary nav should not expose ${paneKey}`);
  });

  assert.ok(html.includes('data-dict-key="ui.label.v3.nav.workspace"'));
  assert.ok(html.includes('data-dict-key="ui.label.v3.nav.group.systemConsole"'));
  assert.ok(html.includes('data-dict-key="ui.label.v3.nav.audit"'));

  assertDictionaryHasTextKeys(dictMap, [
    'ui.label.v3.nav.workspace',
    'ui.label.v3.shell.ops',
    'ui.label.v3.shell.system',
    'ui.label.v3.nav.group.systemConsole',
    'ui.label.v3.nav.home',
    'ui.label.v3.nav.alerts',
    'ui.label.v3.nav.readModel',
    'ui.label.v3.nav.cityPack',
    'ui.label.v3.nav.llm',
    'ui.label.v3.nav.audit',
  ]);

  assert.ok(!html.includes('data-nav-group="system-console"'));
});
