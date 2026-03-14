'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { getRetentionPolicy } = require('../../src/domain/retention/retentionPolicy');

test('phase845: transcript foundation retention and repo-map docs are aligned', () => {
  const policy = getRetentionPolicy('conversation_review_snapshots');
  const lifecycle = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/data_lifecycle.json', 'utf8'));
  const dataModel = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/data_model_map.json', 'utf8'));
  const ssotRetention = fs.readFileSync('docs/SSOT_RETENTION.md', 'utf8');
  const addendum = fs.readFileSync('docs/SSOT_RETENTION_ADDENDUM.md', 'utf8');
  const dataMap = fs.readFileSync('docs/DATA_MAP.md', 'utf8');
  const runbook = fs.readFileSync('docs/QUALITY_PATROL_TRANSCRIPT_RUNBOOK.md', 'utf8');

  assert.equal(policy.kind, 'event');
  assert.equal(policy.retentionDays, 180);

  const lifecycleRow = lifecycle.find((row) => row && row.collection === 'conversation_review_snapshots');
  assert.ok(lifecycleRow);
  assert.equal(lifecycleRow.retention, '180d');
  assert.equal(lifecycleRow.deletable, 'CONDITIONAL');

  const modelRow = (dataModel.collections || []).find((row) => row && row.collection === 'conversation_review_snapshots');
  assert.ok(modelRow);
  assert.deepEqual(modelRow.write_paths, ['src/repos/firestore/conversationReviewSnapshotsRepo.js']);

  assert.match(ssotRetention, /\| conversation_review_snapshots \| event \| 180d \| CONDITIONAL \| YES \|/);
  assert.match(addendum, /\| `conversation_review_snapshots` \| event \| 180d \| CONDITIONAL \| true \|/);
  assert.match(dataMap, /conversation_review_snapshots/);
  assert.match(runbook, /ENABLE_QUALITY_PATROL_TRANSCRIPT_SNAPSHOTS_V1=0/);
});

test('phase845: webhook runtime wiring uses masked transcript append usecase', () => {
  const source = fs.readFileSync('src/routes/webhookLine.js', 'utf8');
  assert.match(source, /appendConversationReviewSnapshot/);
  assert.match(source, /userMessageText: messageText/);
  assert.match(source, /assistantReplyText: replyText/);
  assert.match(source, /payload\.messageText \|\| payload\.text/);
  assert.match(source, /payload\.replyText \|\| payload\.finalReplyText/);
});
