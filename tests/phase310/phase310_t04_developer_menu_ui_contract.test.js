'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase310: app shell includes developer menu and developer-map pane hooks', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="developer-open-map"'));
  assert.ok(html.includes('id="developer-open-system"'));
  assert.ok(html.includes('id="developer-open-audit"'));
  assert.ok(html.includes('id="developer-open-implementation"'));
  assert.ok(html.includes('id="pane-developer-map"'));

  assert.ok(js.includes("'developer-map': { titleKey: 'ui.label.page.developerMap'"));
  assert.ok(js.includes('function setupDeveloperMenu()'));
  assert.ok(js.includes('loadRepoMap({ notify: false });'));
  assert.ok(js.includes("activatePane('developer-map')"));
});
