'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase635: developer-map hides action side panel (repo-map only focus)', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(css.includes('#pane-developer-map .pane-grid'));
  assert.ok(css.includes('#pane-developer-map .pane-actions'));
  assert.ok(css.includes('display: none;'));
});

