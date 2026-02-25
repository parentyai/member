'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase659: SSOT index includes W4 readiness checklist and go decision package', () => {
  const text = fs.readFileSync('docs/SSOT_INDEX.md', 'utf8');
  assert.ok(text.includes('docs/CATCHUP_W4_DESIGN_READINESS_CHECKLIST.md'));
  assert.ok(text.includes('docs/CATCHUP_GO_DECISION_PACKAGE.md'));
});
