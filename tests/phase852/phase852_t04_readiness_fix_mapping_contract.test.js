'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planImprovements } = require('../../src/domain/qualityPatrol/planImprovements');
const { buildRootCauseResult, buildRootCauseReport } = require('./phase852_helpers');

test('phase852: readiness causes map to readiness fix target files', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult({
      rootCauseReports: [buildRootCauseReport({
        issueKey: 'issue_readiness',
        causeCandidates: [{
          causeType: 'readiness_rejection',
          confidence: 'high',
          rank: 1,
          supportingSignals: ['readiness_clarify'],
          supportingEvidence: [],
          evidenceGaps: [],
          upstreamLayer: 'runtime_telemetry',
          downstreamImpact: ['procedural_utility_degraded']
        }]
      })]
    })
  });

  const proposal = result.recommendedPr[0];
  assert.equal(proposal.proposalType, 'readiness_fix');
  assert.ok(proposal.targetFiles.includes('src/domain/llm/quality/evaluateAnswerReadiness.js'));
  assert.ok(proposal.targetFiles.includes('src/domain/llm/quality/runAnswerReadinessGateV2.js'));
});
