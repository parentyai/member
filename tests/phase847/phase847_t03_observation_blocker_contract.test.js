'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildObservationBlockers } = require('../../src/domain/qualityPatrol/transcript/buildObservationBlockers');

test('phase847: buildObservationBlockers returns structured review blockers without failing extraction', () => {
  const blockers = buildObservationBlockers({
    userMessageAvailable: false,
    assistantReplyAvailable: true,
    priorContextSummaryAvailable: false,
    needsPriorContextSummary: true,
    hasTraceEvidence: false,
    hasActionLogEvidence: false,
    expectsFaqEvidence: true,
    hasFaqEvidence: false
  });

  assert.deepEqual(
    blockers.map((row) => row.code),
    [
      'missing_user_message',
      'missing_prior_context_summary',
      'missing_action_log_evidence',
      'missing_faq_evidence',
      'missing_trace_evidence',
      'transcript_not_reviewable'
    ]
  );
  assert.ok(blockers.every((row) => typeof row.message === 'string' && row.message.length > 0));
});
