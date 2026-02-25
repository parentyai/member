'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase658: struct drift runbook keeps dry-run -> apply evidence flow contract', () => {
  const text = fs.readFileSync('docs/RUNBOOK_STRUCT_DRIFT_BACKFILL.md', 'utf8');
  assert.ok(text.includes('`dry-run` → `apply`'));
  assert.ok(text.includes('x-city-pack-job-token'));
  assert.ok(text.includes('scenarioDriftCandidates'));
  assert.ok(text.includes('nextResumeAfterUserId'));
  assert.ok(text.includes('changedCount'));
  assert.ok(text.includes('resumeAfterUserId'));
  assert.ok(text.includes('traceId'));
});
