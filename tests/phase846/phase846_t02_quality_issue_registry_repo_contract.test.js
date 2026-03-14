'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const qualityIssueRegistryRepo = require('../../src/repos/firestore/qualityIssueRegistryRepo');
const { upsertQualityIssue } = require('../../src/usecases/qualityPatrol/upsertQualityIssue');

test('phase846: issue registry appends and dedupes same fingerprint with escalation semantics', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TS');

  try {
    const first = await upsertQualityIssue({
      threadId: 'T001',
      detectedAt: '2026-03-14T10:00:00.000Z',
      layer: 'conversation',
      category: 'followup_reset',
      slice: 'followup',
      severity: 'medium',
      confidence: 0.51,
      latestSummary: 'follow-up lost context once',
      rootCauseHint: ['followup_context_gap'],
      supportingEvidence: [{ signal: 'history_missing', summary: 'history lookup missed' }],
      traceRefs: ['trace_followup_1'],
      sourceCollections: ['llm_action_logs']
    });
    const second = await upsertQualityIssue({
      threadId: 'T001',
      detectedAt: '2026-03-14T11:00:00.000Z',
      layer: 'conversation',
      category: 'followup_reset',
      slice: 'followup',
      severity: 'high',
      confidence: 0.89,
      observationBlocker: true,
      latestSummary: 'follow-up reset repeated with blocker',
      rootCauseHint: ['followup_context_gap'],
      supportingEvidence: [{ signal: 'history_missing', summary: 'history lookup missed again' }],
      traceRefs: ['trace_followup_2'],
      sourceCollections: ['conversation_review_snapshots']
    });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.id, second.id);

    const row = await qualityIssueRegistryRepo.getQualityIssue(first.id);
    assert.equal(row.issueFingerprint, first.issue.issueFingerprint);
    assert.equal(row.occurrenceCount, 2);
    assert.equal(row.firstSeenAt, '2026-03-14T10:00:00.000Z');
    assert.equal(row.lastSeenAt, '2026-03-14T11:00:00.000Z');
    assert.equal(row.severity, 'high');
    assert.equal(row.observationBlocker, true);
    assert.equal(row.status, 'open');
    assert.deepEqual(row.traceRefs, ['trace_followup_1', 'trace_followup_2']);
    assert.deepEqual(row.sourceCollections, ['llm_action_logs', 'conversation_review_snapshots']);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase846: issue registry keeps low-confidence issue in watching state', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TS');

  try {
    const result = await upsertQualityIssue({
      threadId: 'T001',
      detectedAt: '2026-03-14T12:00:00.000Z',
      layer: 'observation',
      category: 'missing_transcript_availability',
      slice: 'unknown',
      confidence: 0.2,
      latestSummary: 'transcript coverage too small'
    });
    const row = await qualityIssueRegistryRepo.getQualityIssue(result.id);
    assert.equal(row.status, 'watching');
    assert.equal(row.firstSeenAt, '2026-03-14T12:00:00.000Z');
    assert.equal(row.lastSeenAt, '2026-03-14T12:00:00.000Z');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
