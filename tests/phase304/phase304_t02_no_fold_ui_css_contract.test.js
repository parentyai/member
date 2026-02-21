'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('phase304: css enforces no-fold behavior and hides decision summaries', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  assert.ok(css.includes('details:not([open]) > *:not(summary)'));
  assert.ok(css.includes('.decision-card,'));
  assert.ok(css.includes('.decision-details > summary'));
  assert.ok(css.includes('.composer-hidden-input'));
});

