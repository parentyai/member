'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase593: maintenance dictionary includes missing-index surface labels', () => {
  const text = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  assert.ok(text.includes('"ui.label.maintenance.missingIndexSurface.title"'));
  assert.ok(text.includes('"ui.label.maintenance.missingIndexSurface.table.file"'));
  assert.ok(text.includes('"ui.desc.maintenance.missingIndexSurface.note"'));
  assert.ok(text.includes('"ui.toast.maintenance.missingIndexSurface.reloadOk"'));
});
