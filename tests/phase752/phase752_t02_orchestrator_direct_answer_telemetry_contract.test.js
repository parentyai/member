'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');
const { generatePaidCasualReply } = require('../../src/usecases/assistant/generatePaidCasualReply');
const { generatePaidDomainConciergeReply } = require('../../src/usecases/assistant/generatePaidDomainConciergeReply');

test('phase752: orchestrator emits direct-answer-first telemetry for domain follow-up', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE752',
    planInfo: { plan: 'pro', status: 'active' },
    messageText: 'SSNの必要書類は？',
    routerMode: 'question',
    routerReason: 'ssn_intent_detected',
    explicitPaidIntent: null,
    paidIntent: 'situation_analysis',
    llmFlags: {
      llmConciergeEnabled: true,
      llmWebSearchEnabled: true,
      llmStyleEngineEnabled: true,
      llmBanditEnabled: false,
      qualityEnabled: true,
      snapshotStrictMode: false
    },
    contextSnapshot: {
      phase: 'arrival',
      topOpenTasks: [{ key: 'ssn_application', status: 'open' }]
    },
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'ssn',
        followupIntent: 'docs_required'
      }
    ],
    deps: {
      generatePaidCasualReply,
      generateDomainConciergeCandidate: async (args) => generatePaidDomainConciergeReply(args),
      generateGroundedReply: async () => ({ ok: false, blockedReason: 'not_used' })
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.telemetry.directAnswerApplied, true);
  assert.equal(result.telemetry.clarifySuppressed, true);
  assert.equal(typeof result.telemetry.contextCarryScore, 'number');
  assert.equal(result.telemetry.contextCarryScore >= 0, true);
  assert.equal(result.telemetry.followupIntent, 'docs_required');
  assert.match(result.replyText, /SSN/);
});
