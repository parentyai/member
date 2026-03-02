'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase703: SSOT_INDEX includes unreachable finalization SSOT entry', () => {
  const text = fs.readFileSync('docs/SSOT_INDEX.md', 'utf8');
  assert.ok(text.includes('docs/SSOT_UNREACHABLE_FINALIZATION_V1.md'));
});
