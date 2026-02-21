'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const HTML_PATH = path.resolve(__dirname, '../../apps/admin/app.html');
const JS_PATH = path.resolve(__dirname, '../../apps/admin/assets/admin_app.js');

test('phase313: developer map includes LEGACY status controls without removing existing routes', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const js = fs.readFileSync(JS_PATH, 'utf8');

  assert.match(html, /id="developer-open-legacy"/);
  assert.match(html, /id="repo-map-load-legacy"/);
  assert.match(html, /id="repo-map-legacy-status-rows"/);
  assert.match(html, /id="repo-map-open-legacy-review"/);

  assert.match(js, /\/api\/admin\/legacy-status/);
  assert.match(js, /developer-open-legacy/);
  assert.match(js, /repo-map-load-legacy/);
});
