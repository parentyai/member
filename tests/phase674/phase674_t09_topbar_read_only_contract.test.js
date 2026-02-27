'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function extractFunctionBody(source, functionName, nextAnchor) {
  const start = source.indexOf(`function ${functionName}()`);
  if (start === -1) return '';
  const end = source.indexOf(`function ${nextAnchor}(`, start);
  if (end === -1) return source.slice(start);
  return source.slice(start, end);
}

test('phase674: header/topbar shortcut stays read-only (no write API call in setupHeaderActions)', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const body = extractFunctionBody(src, 'setupHeaderActions', 'clearElementChildren');

  assert.ok(body.includes('bindReadOnlyShortcut'));
  assert.ok(!body.includes('/api/phase1/events'));
  assert.ok(!body.includes("method: 'POST'"));
  assert.ok(!body.includes('postJson('));
  assert.ok(!body.includes('fetch('));
});
