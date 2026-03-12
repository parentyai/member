'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveIntentRiskTier } = require('../../src/domain/llm/policy/resolveIntentRiskTier');
const { resolveSharedAnswerReadiness } = require('../../src/domain/llm/quality/resolveSharedAnswerReadiness');

test('phase803: resolveIntentRiskTier maps cross-system aliases into v2 tiers', () => {
  const city = resolveIntentRiskTier({ domainIntent: 'city' });
  const faq = resolveIntentRiskTier({ domainIntent: 'faq' });
  const emergency = resolveIntentRiskTier({ domainIntent: 'emergency_layer' });

  assert.equal(city.domainIntent, 'city_pack');
  assert.equal(city.intentRiskTier, 'medium');

  assert.equal(faq.domainIntent, 'saved_faq');
  assert.equal(faq.intentRiskTier, 'medium');

  assert.equal(emergency.domainIntent, 'emergency');
  assert.equal(emergency.intentRiskTier, 'high');
});

test('phase803: resolveIntentRiskTier adds cross-system context reason codes', () => {
  const snapshot = resolveIntentRiskTier({
    domainIntent: 'general',
    emergencyContext: true,
    taskBlockerDetected: true,
    journeyContext: true,
    cityPackContext: true,
    savedFaqReused: true
  });

  assert.equal(snapshot.domainIntent, 'emergency');
  assert.equal(snapshot.intentRiskTier, 'high');
  assert.ok(snapshot.riskReasonCodes.includes('emergency_context_active'));
  assert.ok(snapshot.riskReasonCodes.includes('task_blocker_detected'));
  assert.ok(snapshot.riskReasonCodes.includes('journey_context_active'));
  assert.ok(snapshot.riskReasonCodes.includes('city_pack_context_active'));
  assert.ok(snapshot.riskReasonCodes.includes('saved_faq_context_active'));
});

test('phase803: resolveSharedAnswerReadiness forwards saved FAQ and city context into risk resolution', () => {
  const result = resolveSharedAnswerReadiness({
    domainIntent: 'faq',
    savedFaqReused: true,
    cityPackContext: true,
    llmUsed: false,
    replyText: '',
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    sourceReadinessDecision: 'clarify'
  });

  assert.equal(result.domainIntent, 'saved_faq');
  assert.equal(result.intentRiskTier, 'medium');
});
