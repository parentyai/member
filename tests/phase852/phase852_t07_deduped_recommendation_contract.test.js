'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planImprovements } = require('../../src/domain/qualityPatrol/planImprovements');
const { buildRootCauseResult, buildRootCauseReport } = require('./phase852_helpers');

test('phase852: similar cause family recommendations are deduped into one proposal', () => {
  const reportA = buildRootCauseReport({
    issueKey: 'issue_a',
    causeCandidates: [{
      causeType: 'knowledge_candidate_unused',
      confidence: 'medium',
      rank: 1,
      supportingSignals: ['knowledge_available_but_unused'],
      supportingEvidence: [],
      evidenceGaps: [],
      upstreamLayer: 'runtime_telemetry',
      downstreamImpact: ['saved_faq_unused']
    }]
  });
  const reportB = buildRootCauseReport({
    issueKey: 'issue_b',
    causeCandidates: [{
      causeType: 'fallback_selected_over_grounded',
      confidence: 'medium',
      rank: 1,
      supportingSignals: ['fallback_selected_over_grounded'],
      supportingEvidence: [],
      evidenceGaps: [],
      upstreamLayer: 'runtime_telemetry',
      downstreamImpact: ['knowledge_activation_missing']
    }]
  });

  const result = planImprovements({
    rootCauseResult: buildRootCauseResult({
      rootCauseReports: [reportA, reportB]
    })
  });

  assert.equal(result.recommendedPr.length, 1);
  assert.equal(result.recommendedPr[0].proposalType, 'knowledge_fix');
  assert.deepEqual(result.recommendedPr[0].rootCauseRefs.sort(), ['issue_a:knowledge_candidate_unused', 'issue_b:fallback_selected_over_grounded']);
});
