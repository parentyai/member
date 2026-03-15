'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');

function buildTranscriptCoverage() {
  return {
    observedCount: 2,
    writtenCount: 0,
    skippedCount: 2,
    failedCount: 0,
    transcriptWriteOutcomeCounts: {
      written: 0,
      skipped_flag_disabled: 0,
      skipped_missing_line_user_key: 0,
      skipped_unreviewable_transcript: 2,
      failed_repo_write: 0,
      failed_unknown: 0
    },
    transcriptWriteFailureReasons: {
      transcript_unavailable: 2
    },
    snapshotInputDiagnostics: {
      assistant_reply_missing: 1,
      sanitized_reply_empty: 1,
      masking_removed_text: 0,
      region_prompt_fallback: 0,
      assistantReplyPresent: { trueCount: 1, falseCount: 1 },
      assistantReplyLength: { observedCount: 2, min: 0, max: 12, avg: 6 },
      sanitizedReplyLength: { observedCount: 2, min: 0, max: 12, avg: 6 },
      snapshotBuildAttempted: { trueCount: 2, falseCount: 0 },
      snapshotBuildSkippedReason: {
        feature_flag_off: 0,
        line_user_key_missing: 0,
        assistant_reply_missing: 1,
        sanitized_reply_empty: 1,
        masking_removed_text: 0,
        region_prompt_fallback: 0
      }
    },
    transcriptCoverageStatus: 'blocked',
    sourceCollections: ['llm_action_logs']
  };
}

test('phase853: operator evidence surfaces transcript snapshot diagnostics counts while human stays compressed', () => {
  const operator = buildPatrolQueryResponse({
    audience: 'operator',
    mode: 'latest',
    generatedAt: '2026-03-15T00:00:00.000Z',
    reviewUnits: [],
    evaluations: [],
    metrics: {},
    transcriptCoverage: buildTranscriptCoverage(),
    kpiSummary: { overallStatus: 'blocked' },
    issues: [],
    rootCauseReports: [],
    recommendedPr: [],
    planObservationBlockers: [],
    planningStatus: 'blocked',
    joinDiagnostics: null,
    existingIssues: [],
    existingBacklog: [],
    sourceCollections: ['llm_action_logs']
  });
  const human = buildPatrolQueryResponse({
    audience: 'human',
    mode: 'latest',
    generatedAt: '2026-03-15T00:00:00.000Z',
    reviewUnits: [],
    evaluations: [],
    metrics: {},
    transcriptCoverage: buildTranscriptCoverage(),
    kpiSummary: { overallStatus: 'blocked' },
    issues: [],
    rootCauseReports: [],
    recommendedPr: [],
    planObservationBlockers: [],
    planningStatus: 'blocked',
    joinDiagnostics: null,
    existingIssues: [],
    existingBacklog: [],
    sourceCollections: ['llm_action_logs']
  });

  const operatorSummary = operator.evidence.find((item) => item && item.kind === 'summary' && item.provenance === 'quality_patrol_transcript_coverage');
  const humanSummary = human.evidence.find((item) => item && item.kind === 'summary' && item.provenance === 'quality_patrol_transcript_coverage');

  assert.ok(operatorSummary);
  assert.match(operatorSummary.summary, /snapshotDiagnostics/);
  assert.match(operatorSummary.summary, /assistant_reply_missing/);
  assert.ok(humanSummary);
  assert.doesNotMatch(humanSummary.summary, /snapshotDiagnostics/);
  assert.doesNotMatch(humanSummary.summary, /assistant_reply_missing/);
});
