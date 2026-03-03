'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase635: composer places saved list on the right side of live preview and keeps compact preview size', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(css.includes('.composer-workspace {'));
  assert.ok(css.includes('.composer-main-layout {'));
  assert.ok(css.includes('grid-template-columns: minmax(360px, 420px) minmax(0, 1fr);'));
  assert.ok(css.includes('.composer-left-stack {'));
  assert.ok(css.includes('align-content: start;'));
  assert.ok(css.includes('.composer-preview-fixed-wrap {'));
  assert.ok(css.includes('.line-preview-phone {'));
  assert.ok(css.includes('width: 360px;'));
  assert.ok(css.includes('height: 160px;'));
  assert.ok(css.includes('@media (max-width: 1100px)'));
  assert.ok(css.includes('.composer-main-layout {'));
  assert.ok(css.includes('grid-template-columns: 1fr;'));
  assert.ok(css.includes('#composer-saved-panel {'));
  assert.ok(css.includes('order: 2;'));
});
