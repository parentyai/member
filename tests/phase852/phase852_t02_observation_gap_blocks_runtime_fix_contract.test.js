'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planImprovements } = require('../../src/domain/qualityPatrol/planImprovements');
const { buildRootCauseResult, buildRootCauseReport } = require('./phase852_helpers');

test('phase852: observation gap blocks runtime-fix style proposals', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult({
      rootCauseReports: [buildRootCauseReport({
        issueKey: 'issue_observation_gap',
        analysisStatus: 'blocked',
        observationBlockers: [{ code: 'transcript_not_reviewable', severity: 'high', source: 'transcript' }],
        causeCandidates: [{
          causeType: 'observation_gap',
          confidence: 'medium',
          rank: 1,
          supportingSignals: ['observation_gap'],
          supportingEvidence: [],
          evidenceGaps: ['missing_review_units'],
          upstreamLayer: 'detection',
          downstreamImpact: ['transcript_availability_low']
        }]
      })]
    })
  });

  assert.equal(result.planningStatus, 'blocked');
  assert.equal(result.recommendedPr[0].proposalType, 'blocked_by_observation_gap');
});
