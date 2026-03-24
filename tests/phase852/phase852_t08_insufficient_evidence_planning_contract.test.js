'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planImprovements } = require('../../src/domain/qualityPatrol/planImprovements');
const { buildRootCauseResult, buildRootCauseReport } = require('./phase852_helpers');

test('phase852: insufficient evidence produces no-action proposal instead of aggressive runtime fix', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult({
      rootCauseReports: [buildRootCauseReport({
        issueKey: 'issue_insufficient',
        analysisStatus: 'insufficient_evidence',
        causeCandidates: [{
          causeType: 'evidence_insufficient',
          confidence: 'low',
          rank: 1,
          supportingSignals: ['evidence_insufficient'],
          supportingEvidence: [],
          evidenceGaps: ['missing_trace_bundles'],
          upstreamLayer: 'detection',
          downstreamImpact: ['naturalness_degraded']
        }]
      })]
    })
  });

  assert.equal(result.planningStatus, 'insufficient_evidence');
  assert.equal(result.recommendedPr[0].proposalType, 'no_action_until_evidence');
  assert.ok(result.recommendedPr[0].blockedBy.includes('missing_trace_bundles'));
});

test('phase852: historical-only insufficient evidence does not keep active planning in insufficient state', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult({
      rootCauseReports: [buildRootCauseReport({
        issueKey: 'issue_historical_insufficient',
        historicalOnly: true,
        analysisStatus: 'insufficient_evidence',
        causeCandidates: [{
          causeType: 'evidence_insufficient',
          confidence: 'low',
          rank: 1,
          supportingSignals: ['evidence_insufficient'],
          supportingEvidence: [],
          evidenceGaps: ['missing_trace_bundles'],
          upstreamLayer: 'detection',
          downstreamImpact: ['specificity_degraded']
        }]
      })]
    })
  });

  assert.equal(result.planningStatus, 'planned');
  assert.deepEqual(result.recommendedPr, []);
  assert.deepEqual(result.observationBlockers, []);
});
