'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { stateCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase635: list state serializes to query and restores from query', () => {
  const nextUrl = stateCore.applyListStateToUrl(
    'usersSummary',
    { sortKey: 'createdAt', sortDir: 'desc', category: 'A' },
    { url: 'http://localhost/admin/app?pane=read-model' }
  );
  assert.ok(nextUrl.includes('pane=read-model'));
  assert.ok(nextUrl.includes('usersSummary.sortKey=createdAt'));
  assert.ok(nextUrl.includes('usersSummary.sortDir=desc'));
  assert.ok(nextUrl.includes('usersSummary.category=A'));

  const restored = stateCore.parseListStateFromQuery('usersSummary', nextUrl.split('?')[1]);
  assert.equal(restored.sortKey, 'createdAt');
  assert.equal(restored.sortDir, 'desc');
  assert.equal(restored.category, 'A');
});

test('phase635: merge priority keeps URL over storage and defaults', () => {
  const merged = stateCore.mergeStatePriority(
    { sortDir: 'asc' },
    { sortDir: 'desc', category: 'C' },
    { sortDir: 'desc', category: 'A', limit: '200' }
  );
  assert.equal(merged.sortDir, 'asc');
  assert.equal(merged.category, 'C');
  assert.equal(merged.limit, '200');
});
