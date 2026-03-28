'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildObservationBlockerRows } = require('../../src/domain/qualityPatrol/query/buildObservationBlockerRows');

test('phase856: ready transcript coverage suppresses transcript write blocker even when raw blocker codes remain', () => {
  const rows = buildObservationBlockerRows({
    audience: 'operator',
    planningStatus: 'blocked',
    transcriptCoverage: {
      observedCount: 100,
      transcriptCoverageStatus: 'ready',
      transcriptWriteOutcomeCounts: {
        written: 100,
        skipped_unreviewable_transcript: 0,
        failed_repo_write: 0,
        failed_unknown: 0
      },
      transcriptWriteFailureReasons: {}
    },
    joinDiagnostics: {
      faqOnlyRowsSkipped: 0,
      traceHydrationLimitedCount: 0,
      reviewUnitAnchorKindCounts: {
        snapshot_action: 100
      }
    },
    reviewUnits: [],
    rootCauseReports: [{
      slice: 'other',
      causeCandidates: [{
        causeType: 'observation_gap'
      }],
      observationBlockers: [
        {
          code: 'missing_assistant_reply',
          severity: 'high',
          message: 'Masked assistant reply snapshot is unavailable.',
          source: 'conversation_review_snapshots'
        },
        {
          code: 'transcript_not_reviewable',
          severity: 'high',
          message: 'Conversation transcript is not reviewable.',
          source: 'conversation_review_snapshots'
        }
      ]
    }],
    issues: [],
    recommendedPr: [{
      proposalType: 'blocked_by_observation_gap'
    }]
  });

  assert.ok(rows.some((row) => row.code === 'observation_gap'));
  assert.ok(!rows.some((row) => row.code === 'transcript_write_coverage_missing'));
});
