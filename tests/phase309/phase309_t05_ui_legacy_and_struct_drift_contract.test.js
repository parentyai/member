'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase309: review legacy page exposes LEGACY guidance to /admin/app', () => {
  const html = fs.readFileSync('apps/admin/review.html', 'utf8');
  assert.ok(html.includes('LEGACY画面です'));
  assert.ok(html.includes('/admin/app?pane=audit'));
});

test('phase309: admin app includes struct drift panel controls and handlers', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(html.includes('struct-drift-run-dry'));
  assert.ok(html.includes('struct-drift-run-apply'));
  assert.ok(html.includes('struct-drift-runs-rows'));
  assert.ok(js.includes('runStructDriftBackfill('));
  assert.ok(js.includes('loadStructDriftRuns('));
});
