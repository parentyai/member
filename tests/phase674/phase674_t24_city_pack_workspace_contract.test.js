'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: city pack pane keeps workbench/detail workspace switch contract', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="city-pack-workspace-workbench"'));
  assert.ok(html.includes('id="city-pack-workspace-detail"'));
  assert.ok(html.includes('data-city-pack-workspace-target="workbench"'));
  assert.ok(html.includes('data-city-pack-workspace-target="detail"'));
  assert.ok(html.includes('data-city-pack-workspace-surface="workbench"'));
  assert.ok(html.includes('data-city-pack-workspace-surface="detail"'));
  assert.ok(html.includes('id="city-pack-workspace-back-workbench"'));

  assert.ok(js.includes('const CITY_PACK_WORKSPACE_VIEW_WORKBENCH = \'workbench\';'));
  assert.ok(js.includes('const CITY_PACK_WORKSPACE_VIEW_DETAIL = \'detail\';'));
  assert.ok(js.includes('function applyCityPackWorkspaceView(view, options)'));
  assert.ok(js.includes('data-city-pack-workspace-view'));
  assert.ok(js.includes('document.querySelectorAll(\'[data-city-pack-workspace-target]\')'));

  assert.ok(css.includes('#pane-city-pack[data-city-pack-workspace-view="workbench"] [data-city-pack-workspace-surface="detail"]'));
  assert.ok(css.includes('#pane-city-pack[data-city-pack-workspace-view="detail"] [data-city-pack-workspace-surface="workbench"]'));
});
