'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase342: retention runs ui dictionary keys exist', () => {
  const src = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  assert.ok(src.includes('"ui.label.maintenance.retentionRuns.title"'));
  assert.ok(src.includes('"ui.label.maintenance.retentionRuns.reload"'));
  assert.ok(src.includes('"ui.toast.maintenance.retentionRuns.reloadOk"'));
});
