'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildDeterministicCandidates } = require('../../src/domain/llm/conversation/actionSelector');
const { computeReward, DEFAULT_REWARD_WEIGHTS } = require('../../src/usecases/assistant/learning/finalizeLlmActionRewards');
const { normalizeRewardSignals } = require('../../src/repos/firestore/llmActionLogsRepo');

test('phase717: action selector scoreBreakdown keeps legacy keys and exposes v2 weights', () => {
  const candidates = buildDeterministicCandidates({
    styleDecision: { styleId: 'Checklist', askClarifying: false, maxActions: 3 },
    confidence: { intentConfidence: 0.8, contextConfidence: 0.8 },
    mode: 'B',
    topic: 'visa',
    userTier: 'paid',
    messageLength: 42,
    timeOfDay: 9,
    evidenceNeed: 'required'
  });

  assert.ok(candidates.length > 0);
  const top = candidates[0];
  assert.ok(top.scoreBreakdown && typeof top.scoreBreakdown === 'object');
  assert.equal(typeof top.scoreBreakdown.base, 'number');
  assert.equal(typeof top.scoreBreakdown.primaryStyle, 'number');
  assert.equal(typeof top.scoreBreakdown.modeFit, 'number');
  assert.equal(typeof top.scoreBreakdown.wStyle, 'number');
  assert.equal(typeof top.scoreBreakdown.wTiming, 'number');
  assert.equal(typeof top.scoreBreakdown.wCta, 'number');
  assert.equal(typeof top.scoreBreakdown.penalties, 'number');
});

test('phase717: reward signal v2 normalization keeps backwards compatibility aliases', () => {
  const normalized = normalizeRewardSignals({
    clickPrimary: true,
    clickSecondary: false,
    taskDone: true,
    blockedResolved: true,
    unsubscribe: false,
    spam: false,
    wrongEvidence: true
  });

  assert.equal(normalized.click, true);
  assert.equal(normalized.clickPrimary, true);
  assert.equal(normalized.taskDone, true);
  assert.equal(normalized.taskComplete, true);
  assert.equal(normalized.unsubscribe, false);
  assert.equal(normalized.spam, false);
  assert.equal(normalized.wrongEvidence, true);
});

test('phase717: reward scorer supports v2 signals and legacy aliases', () => {
  const legacy = computeReward({
    click: true,
    taskComplete: true,
    blockedResolved: true,
    citationMissing: true,
    wrongEvidence: true
  }, DEFAULT_REWARD_WEIGHTS);
  assert.equal(legacy, -2);

  const v2 = computeReward({
    clickPrimary: true,
    clickSecondary: true,
    taskDone: true,
    blockedResolved: true,
    unsubscribe: false,
    spam: false,
    citationMissing: false,
    wrongEvidence: false
  }, DEFAULT_REWARD_WEIGHTS);
  assert.equal(v2, 6.5);
});
