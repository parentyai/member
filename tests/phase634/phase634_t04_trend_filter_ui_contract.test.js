'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase634: unified tables include filter chips, clear button, and result counts', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  [
    'composer-saved-filter-chips',
    'composer-saved-result-count',
    'composer-saved-clear',
    'users-summary-filter-chips',
    'users-summary-result-count',
    'users-summary-clear',
    'city-pack-unified-filter-chips',
    'city-pack-unified-result-count',
    'city-pack-unified-clear',
    'vendor-unified-filter-chips',
    'vendor-unified-result-count',
    'vendor-unified-clear'
  ].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`));
  });
});
