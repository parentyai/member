'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planImprovements } = require('../../src/domain/qualityPatrol/planImprovements');
const { buildRootCauseResult, buildRootCauseReport } = require('./phase852_helpers');

test('phase852: finalizer template collapse maps to template fix target files', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult({
      rootCauseReports: [buildRootCauseReport({
        issueKey: 'issue_template',
        causeCandidates: [{
          causeType: 'finalizer_template_collapse',
          confidence: 'high',
          rank: 1,
          supportingSignals: ['repeat_risk_high'],
          supportingEvidence: [],
          evidenceGaps: [],
          upstreamLayer: 'runtime_telemetry',
          downstreamImpact: ['repeated_template_response']
        }]
      })]
    })
  });

  const proposal = result.recommendedPr[0];
  assert.equal(proposal.proposalType, 'template_fix');
  assert.ok(proposal.targetFiles.includes('src/domain/llm/orchestrator/finalizeCandidate.js'));
  assert.ok(proposal.targetFiles.includes('src/domain/llm/conversation/paidReplyGuard.js'));
});
