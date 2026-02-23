'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase635: composer keeps two-column layout on desktop (create left, preview right)', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(css.includes('.composer-layout {'));
  assert.ok(css.includes('grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);'));
  assert.ok(css.includes('@media (max-width: 1100px)'));
  assert.ok(css.includes('.composer-layout {\n    grid-template-columns: 1fr;'));
});

