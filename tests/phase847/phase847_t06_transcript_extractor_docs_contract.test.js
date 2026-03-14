'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase847: transcript extractor docs describe read-only review units and existing retention sources', () => {
  const dataMap = fs.readFileSync('docs/DATA_MAP.md', 'utf8');
  const retention = fs.readFileSync('docs/SSOT_RETENTION.md', 'utf8');
  const transcriptRunbook = fs.readFileSync('docs/QUALITY_PATROL_TRANSCRIPT_RUNBOOK.md', 'utf8');
  const reviewUnitsRunbook = fs.readFileSync('docs/QUALITY_PATROL_REVIEW_UNITS_RUNBOOK.md', 'utf8');

  assert.match(dataMap, /quality patrol review units/i);
  assert.match(dataMap, /not persisted/i);
  assert.match(retention, /review units are derived read-only outputs/i);
  assert.match(transcriptRunbook, /review units consume `conversation_review_snapshots` read-only/i);
  assert.match(reviewUnitsRunbook, /missing_user_message/);
  assert.match(reviewUnitsRunbook, /follow-up/);
});
