'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationReviewUnits } = require('../../src/domain/qualityPatrol/transcript/buildConversationReviewUnits');

test('phase847: missing action evidence and missing trace evidence remain distinguishable from join-limit suppression', () => {
  const units = buildConversationReviewUnits({
    snapshots: [{
      id: 'snapshot_missing_sources',
      lineUserKey: 'userkey_phase847_missing_sources',
      traceId: 'trace_missing_sources',
      userMessageMasked: 'ユーザー質問',
      assistantReplyMasked: '返信',
      priorContextSummaryMasked: '',
      userMessageAvailable: true,
      assistantReplyAvailable: true,
      priorContextSummaryAvailable: false,
      createdAt: '2026-03-14T15:00:00.000Z'
    }],
    llmActionLogs: [],
    faqAnswerLogs: [],
    traceBundles: {}
  });

  assert.equal(units.length, 1);
  const unit = units[0];
  assert.equal(unit.anchorKind, 'snapshot_only');
  assert.equal(unit.evidenceJoinStatus.actionLog, 'missing_source');
  assert.equal(unit.evidenceJoinStatus.trace, 'missing_source');
  assert.ok(unit.observationBlockers.some((row) => row.code === 'missing_action_log_evidence'));
  assert.ok(unit.observationBlockers.some((row) => row.code === 'missing_trace_evidence'));
});
