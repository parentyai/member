'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase742: index wires uxos foundation read-only routes', () => {
  const src = fs.readFileSync('src/index.js', 'utf8');
  assert.ok(src.includes("pathname === '/api/admin/os/uxos/next-action'"));
  assert.ok(src.includes("pathname === '/api/admin/os/ux-policy/readonly'"));
});

test('phase742: ssot index includes uxos foundation doc', () => {
  const src = fs.readFileSync('docs/SSOT_INDEX.md', 'utf8');
  assert.ok(src.includes('docs/SSOT_UXOS_FOUNDATION_P0_V1.md'));
});
