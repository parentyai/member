'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase649: SSOT index includes phase compression shortcuts', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs', 'SSOT_INDEX.md'), 'utf8');
  assert.ok(text.includes('docs/archive/phases/'));
  assert.ok(text.includes('docs/PHASE_PATH_MAP.json'));
  assert.ok(text.includes('docs/REPO_AUDIT_INPUTS/phase_compression_baseline.json'));
});
