'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectOpportunity } = require('../../src/usecases/assistant/opportunity/detectOpportunity');

test('phase717: opportunity detector keeps greeting in casual mode', () => {
  const result = detectOpportunity({
    lineUserId: 'U717_OPP_1',
    userTier: 'paid',
    messageText: 'こんにちは',
    journeyPhase: 'pre',
    topTasks: [],
    blockedTask: null,
    dueSoonTask: null,
    riskFlags: [],
    recentEngagement: {
      recentTurns: 5,
      recentInterventions: 0,
      recentClicks: false,
      recentTaskDone: false
    },
    llmConciergeEnabled: true
  });

  assert.equal(result.conversationMode, 'casual');
  assert.equal(result.opportunityType, 'none');
  assert.equal(result.interventionBudget, 0);
  assert.ok(result.opportunityReasonKeys.includes('greeting_detected'));
});

test('phase717: opportunity detector promotes action keyword to concierge intervention when cooldown is clear', () => {
  const result = detectOpportunity({
    lineUserId: 'U717_OPP_2',
    userTier: 'paid',
    messageText: '学校どうしよう',
    journeyPhase: 'arrival',
    topTasks: [
      { key: 'school_registration', status: 'open', due: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
      { key: 'vaccine_record', status: 'open', due: null }
    ],
    blockedTask: null,
    dueSoonTask: { key: 'school_registration', status: 'open', due: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
    riskFlags: [],
    recentEngagement: {
      recentTurns: 5,
      recentInterventions: 0,
      recentClicks: false,
      recentTaskDone: false
    },
    llmConciergeEnabled: true
  });

  assert.equal(result.conversationMode, 'concierge');
  assert.equal(result.opportunityType, 'action');
  assert.equal(result.interventionBudget, 1);
  assert.ok(result.opportunityReasonKeys.includes('action_signal'));
  assert.ok(Array.isArray(result.suggestedAtoms.nextActions));
  assert.ok(result.suggestedAtoms.nextActions.length <= 3);
});

test('phase717: opportunity detector suppresses intervention when cooldown is active', () => {
  const result = detectOpportunity({
    lineUserId: 'U717_OPP_3',
    userTier: 'paid',
    messageText: '学校どうしよう',
    journeyPhase: 'arrival',
    topTasks: [{ key: 'school_registration', status: 'open', due: null }],
    blockedTask: null,
    dueSoonTask: null,
    riskFlags: [],
    recentEngagement: {
      recentTurns: 5,
      recentInterventions: 1,
      recentClicks: false,
      recentTaskDone: false
    },
    llmConciergeEnabled: true
  });

  assert.equal(result.conversationMode, 'casual');
  assert.equal(result.opportunityType, 'action');
  assert.equal(result.interventionBudget, 0);
  assert.ok(result.opportunityReasonKeys.includes('intervention_cooldown_active'));
});

test('phase717: opportunity detector prioritizes blocked opportunity when blocked signal exists', () => {
  const result = detectOpportunity({
    userTier: 'paid',
    llmConciergeEnabled: true,
    messageText: '手続きが進まない',
    blockedTask: { key: 'visa_review', status: 'locked' },
    topTasks: [{ key: 'visa_review', status: 'locked' }],
    recentEngagement: { recentTurns: 5, recentInterventions: 0 }
  });

  assert.equal(result.opportunityType, 'blocked');
  assert.equal(result.conversationMode, 'concierge');
  assert.equal(result.interventionBudget, 1);
  assert.ok(result.opportunityReasonKeys.includes('blocked_signal'));
  assert.ok(result.opportunityReasonKeys.includes('blocked_keyword'));
});

test('phase717: opportunity detector marks life opportunity on weekend-like prompt', () => {
  const result = detectOpportunity({
    userTier: 'paid',
    llmConciergeEnabled: true,
    messageText: '週末どこから進めるべき？',
    topTasks: [],
    recentEngagement: { recentTurns: 5, recentInterventions: 0 }
  });

  assert.equal(result.opportunityType, 'life');
  assert.equal(result.conversationMode, 'concierge');
  assert.equal(result.interventionBudget, 1);
  assert.ok(result.opportunityReasonKeys.includes('life_signal'));
  assert.ok(result.opportunityReasonKeys.includes('life_keyword'));
});
