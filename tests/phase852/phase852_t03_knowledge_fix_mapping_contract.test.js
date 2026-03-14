'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planImprovements } = require('../../src/domain/qualityPatrol/planImprovements');
const { buildRootCauseResult } = require('./phase852_helpers');

test('phase852: knowledge causes map to knowledge fix target files', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult()
  });

  const proposal = result.recommendedPr[0];
  assert.equal(proposal.proposalType, 'knowledge_fix');
  assert.ok(proposal.targetFiles.includes('src/domain/llm/knowledge/buildRuntimeKnowledgeCandidates.js'));
  assert.ok(proposal.targetFiles.includes('src/domain/llm/orchestrator/candidatePriority.js'));
});
