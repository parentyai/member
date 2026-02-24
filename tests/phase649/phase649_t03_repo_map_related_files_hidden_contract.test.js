'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase649: repo map hides related file list (keep DOM add-only)', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  assert.ok(css.includes('.repo-map-related-files-label'));
  assert.ok(css.includes('.repo-map-related-files-list'));
  assert.ok(css.includes('display: none;'));

  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes('repo-map-related-files-label'));
  assert.ok(js.includes('repo-map-related-files-list'));
});

