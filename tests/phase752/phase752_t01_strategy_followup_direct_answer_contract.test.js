'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildStrategyPlan } = require('../../src/domain/llm/orchestrator/strategyPlanner');

test('phase752: followup intent on domain prefers grounded answer before domain concierge in casual route', () => {
  const plan = buildStrategyPlan({
    routerMode: 'casual',
    normalizedConversationIntent: 'school',
    followupIntent: 'docs_required',
    contextResume: true,
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'grounded_answer');
  assert.equal(plan.conversationMode, 'concierge');
  assert.equal(plan.directAnswerFirst, true);
  assert.equal(plan.clarifySuppressed, true);
  assert.equal(plan.fallbackType, 'followup_grounding_probe');
});

test('phase752: followup intent on domain forces domain_concierge direct-answer-first in question route', () => {
  const plan = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'ssn',
    followupIntent: 'appointment_needed',
    contextResume: false,
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'domain_concierge');
  assert.equal(plan.conversationMode, 'concierge');
  assert.equal(plan.directAnswerFirst, true);
  assert.equal(plan.clarifySuppressed, true);
  assert.equal(plan.fallbackType === null || plan.fallbackType === 'followup_direct_answer', true);
});
