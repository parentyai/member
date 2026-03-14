'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');

function buildTranscriptCoverage() {
  return {
    observedCount: 4,
    writtenCount: 1,
    skippedCount: 2,
    failedCount: 1,
    transcriptWriteOutcomeCounts: {
      written: 1,
      skipped_flag_disabled: 0,
      skipped_missing_line_user_key: 1,
      skipped_unreviewable_transcript: 1,
      failed_repo_write: 1,
      failed_unknown: 0
    },
    transcriptWriteFailureReasons: {
      line_user_key_missing: 1,
      repo_write_failed: 1
    },
    transcriptCoverageStatus: 'blocked',
    sourceCollections: ['llm_action_logs']
  };
}

test('phase853: query surfaces transcript coverage diagnostics as evidence without changing top-level shape', () => {
  const operator = buildPatrolQueryResponse({
    audience: 'operator',
    mode: 'latest',
    reviewUnits: [{ reviewUnitId: 'ru', slice: 'other', evidenceRefs: [], sourceCollections: ['llm_action_logs'] }],
    metrics: {},
    transcriptCoverage: buildTranscriptCoverage(),
    kpiSummary: { overallStatus: 'warn' },
    issues: [],
    rootCauseReports: [],
    recommendedPr: [],
    planningStatus: 'planned'
  });

  const human = buildPatrolQueryResponse({
    audience: 'human',
    mode: 'latest',
    reviewUnits: [{ reviewUnitId: 'ru', slice: 'other', evidenceRefs: [], sourceCollections: ['llm_action_logs'] }],
    metrics: {},
    transcriptCoverage: buildTranscriptCoverage(),
    kpiSummary: { overallStatus: 'warn' },
    issues: [],
    rootCauseReports: [],
    recommendedPr: [],
    planningStatus: 'planned'
  });

  const operatorEvidence = operator.evidence.find((item) => item.provenance === 'quality_patrol_transcript_coverage');
  const humanEvidence = human.evidence.find((item) => item.provenance === 'quality_patrol_transcript_coverage');

  assert.ok(operatorEvidence);
  assert.match(operatorEvidence.summary, /transcriptCoverage status=blocked/);
  assert.ok(humanEvidence);
  assert.match(humanEvidence.summary, /transcript 証跡/);
  assert.equal(Array.isArray(operator.issues), true);
  assert.equal(Array.isArray(operator.recommendedPr), true);
});
