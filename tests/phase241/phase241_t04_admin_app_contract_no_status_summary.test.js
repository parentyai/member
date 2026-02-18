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

test('phase241: admin app includes monitor user timeline and insights sections', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('id="monitor-user-search"'));
  assert.ok(html.includes('id="monitor-window-days"'));
  assert.ok(html.includes('id="monitor-vendor-rows"'));
  assert.ok(html.includes('id="monitor-faq-rows"'));
});
