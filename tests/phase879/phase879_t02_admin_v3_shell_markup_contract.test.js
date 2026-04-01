'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase879: app shell adds ops ui v3 and system console chrome without changing legacy nav contracts', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

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

  assert.ok(html.includes('data-dict-key="ui.label.v3.nav.group.today">Today</div>'));
  assert.ok(html.includes('data-dict-key="ui.label.v3.nav.group.systemConsole">System Console</div>'));
  assert.ok(html.includes('data-dict-key="ui.label.v3.nav.composer">送信内容を作る</span>'));
  assert.ok(html.includes('data-dict-key="ui.label.v3.nav.audit">システム記録</span>'));

  assert.ok(!html.includes('data-nav-group="today"'));
  assert.ok(!html.includes('data-nav-group="messages"'));
  assert.ok(!html.includes('data-nav-group="system-console"'));
});
