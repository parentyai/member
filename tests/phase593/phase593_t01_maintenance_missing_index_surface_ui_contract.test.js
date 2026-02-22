'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase593: maintenance pane renders missing-index surface panel controls and table', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('maintenance-missing-index-limit'));
  assert.ok(html.includes('maintenance-missing-index-file-filter'));
  assert.ok(html.includes('maintenance-missing-index-reload'));
  assert.ok(html.includes('maintenance-missing-index-rows'));
  assert.ok(html.includes('maintenance-missing-index-note'));
});

test('phase593: admin app loads missing-index surface endpoint and wires reload action', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes('function loadMissingIndexSurface'));
  assert.ok(js.includes('/api/admin/missing-index-surface?'));
  assert.ok(js.includes("document.getElementById('maintenance-missing-index-reload')?.addEventListener"));
  assert.ok(js.includes('void loadMissingIndexSurface({ notify: false });'));
});
