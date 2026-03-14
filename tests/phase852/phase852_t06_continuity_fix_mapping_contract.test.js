'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planImprovements } = require('../../src/domain/qualityPatrol/planImprovements');
const { buildRootCauseResult, buildRootCauseReport } = require('./phase852_helpers');

test('phase852: follow-up continuity causes map to continuity fix target files', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult({
      rootCauseReports: [buildRootCauseReport({
        issueKey: 'issue_continuity',
        slice: 'follow-up',
        causeCandidates: [{
          causeType: 'followup_context_loss',
          confidence: 'high',
          rank: 1,
          supportingSignals: ['prior_context_not_used'],
          supportingEvidence: [],
          evidenceGaps: [],
          upstreamLayer: 'runtime_telemetry',
          downstreamImpact: ['followup_context_reset']
        }]
      })]
    })
  });

  const proposal = result.recommendedPr[0];
  assert.equal(proposal.proposalType, 'continuity_fix');
  assert.ok(proposal.targetFiles.includes('src/domain/llm/orchestrator/buildConversationPacket.js'));
  assert.ok(proposal.targetFiles.includes('src/domain/llm/orchestrator/followupIntentResolver.js'));
});
