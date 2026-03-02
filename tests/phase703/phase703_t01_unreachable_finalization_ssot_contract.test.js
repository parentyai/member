'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const SSOT_PATH = 'docs/SSOT_UNREACHABLE_FINALIZATION_V1.md';

test('phase703: unreachable finalization SSOT exists and includes both target files', () => {
  assert.equal(fs.existsSync(SSOT_PATH), true, `missing ${SSOT_PATH}`);
  const text = fs.readFileSync(SSOT_PATH, 'utf8');
  assert.ok(text.includes('src/repos/firestore/indexFallbackPolicy.js'));
  assert.ok(text.includes('src/shared/phaseDocPathResolver.js'));
  assert.ok(text.includes('future_deletion_candidate'));
  assert.ok(text.includes('keep_as_build_helper'));
  assert.ok(text.includes('fixed date: 2026-03-02'));
});
