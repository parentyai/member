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

test('phase852: historical-only observation gap does not reopen blocked observation planning', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult({
      rootCauseReports: [
        buildRootCauseReport({
          issueKey: 'issue_historical_observation_gap',
          issueType: 'observation_blocker',
          historicalOnly: true,
          analysisStatus: 'analyzed',
          observationBlockers: [{ code: 'transcript_not_reviewable', severity: 'high', source: 'transcript' }],
          causeCandidates: [{
            causeType: 'observation_gap',
            confidence: 'medium',
            rank: 1,
            supportingSignals: ['observation_gap'],
            supportingEvidence: [],
            evidenceGaps: ['missing_trace_bundles'],
            upstreamLayer: 'detection',
            downstreamImpact: ['reviewable_transcript_rate_low']
          }]
        }),
        buildRootCauseReport({
          issueKey: 'issue_city_specificity',
          issueType: 'specificity',
          slice: 'city',
          observationBlockers: [],
          causeCandidates: [{
            causeType: 'city_specificity_gap',
            confidence: 'high',
            rank: 1,
            supportingSignals: ['cityPackCandidateAvailable', 'cityPackUsedInAnswer_false'],
            supportingEvidence: [],
            evidenceGaps: [],
            upstreamLayer: 'runtime_telemetry',
            downstreamImpact: ['citySpecificityMissingRate']
          }]
        })
      ]
    })
  });

  assert.equal(result.planningStatus, 'planned');
  assert.equal(result.recommendedPr.some((item) => item.proposalType === 'blocked_by_observation_gap'), false);
  assert.deepEqual(result.observationBlockers, []);
  assert.equal(result.recommendedPr[0].proposalType, 'specificity_fix');
});
