'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planImprovements } = require('../../src/domain/qualityPatrol/planImprovements');
const { buildRootCauseResult, buildRootCauseReport } = require('./phase852_helpers');

test('phase852: context override maps to continuity fix with request-contract targets', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult({
      rootCauseReports: [buildRootCauseReport({
        issueKey: 'issue_context_override',
        causeCandidates: [{
          causeType: 'context_override',
          confidence: 'high',
          rank: 1,
          supportingSignals: ['fixed_root_cause_mapping_applied'],
          supportingEvidence: [],
          evidenceGaps: [],
          upstreamLayer: 'fixed_root_cause_map',
          downstreamImpact: ['correction_ignored']
        }]
      })]
    })
  });

  const proposal = result.recommendedPr[0];
  assert.equal(proposal.proposalType, 'continuity_fix');
  assert.ok(proposal.targetFiles.includes('src/domain/llm/orchestrator/buildRequestContract.js'));
  assert.ok(proposal.targetFiles.includes('src/domain/llm/orchestrator/buildConversationPacket.js'));
});

test('phase852: guard template collapse maps to template fix with verifier and guard targets', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult({
      rootCauseReports: [buildRootCauseReport({
        issueKey: 'issue_guard_template_collapse',
        causeCandidates: [{
          causeType: 'guard_template_collapse',
          confidence: 'high',
          rank: 1,
          supportingSignals: ['fixed_root_cause_mapping_applied'],
          supportingEvidence: [],
          evidenceGaps: [],
          upstreamLayer: 'fixed_root_cause_map',
          downstreamImpact: ['generic_loop_fixed_reply']
        }]
      })]
    })
  });

  const proposal = result.recommendedPr[0];
  assert.equal(proposal.proposalType, 'template_fix');
  assert.ok(proposal.targetFiles.includes('src/domain/llm/orchestrator/verifyCandidate.js'));
  assert.ok(proposal.targetFiles.includes('src/domain/llm/conversation/paidReplyGuard.js'));
});

test('phase852: command boundary misfire maps to runtime fix with webhook edge target', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult({
      rootCauseReports: [buildRootCauseReport({
        issueKey: 'issue_command_boundary_misfire',
        causeCandidates: [{
          causeType: 'command_boundary_misfire',
          confidence: 'high',
          rank: 1,
          supportingSignals: ['fixed_root_cause_mapping_applied'],
          supportingEvidence: [],
          evidenceGaps: [],
          upstreamLayer: 'fixed_root_cause_map',
          downstreamImpact: ['command_boundary_collision']
        }]
      })]
    })
  });

  const proposal = result.recommendedPr[0];
  assert.equal(proposal.proposalType, 'runtime_fix');
  assert.ok(proposal.targetFiles.includes('src/routes/webhookLine.js'));
  assert.ok(proposal.targetFiles.includes('src/domain/llm/orchestrator/buildRequestContract.js'));
});
