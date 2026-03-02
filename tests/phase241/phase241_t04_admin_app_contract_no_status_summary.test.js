'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase241: admin app removes status summary panels from operational panes', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(!html.includes('状態サマリー'), 'status summary label should be removed from /admin/app');
  assert.ok(!html.includes('composer-status-panel'));
  assert.ok(!html.includes('monitor-status-panel'));
  assert.ok(!html.includes('errors-status-panel'));
  assert.ok(!html.includes('read-model-status-panel'));
});

test('phase241: admin app monitor pane uses user search + global list layout and hides deprecated sections', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('id="monitor-user-search"'));
  assert.ok(html.includes('id="monitor-user-member-id"'));
  assert.ok(html.includes('id="monitor-global-reload"'));
  assert.ok(html.includes('id="monitor-rows"'));
  assert.ok(html.includes('class="pane-detail is-hidden"'));
  assert.ok(html.includes('class="pane-actions is-hidden"'));
  assert.ok(html.includes('Journey Map / Rule Editor'));
});
