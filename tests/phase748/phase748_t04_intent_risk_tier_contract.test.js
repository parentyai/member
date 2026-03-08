'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveIntentRiskTier } = require('../../src/domain/llm/policy/resolveIntentRiskTier');

test('phase748: resolveIntentRiskTier maps domain intents to tier contract', () => {
  const ssn = resolveIntentRiskTier({ domainIntent: 'ssn' });
  const banking = resolveIntentRiskTier({ domainIntent: 'banking' });
  const school = resolveIntentRiskTier({ domainIntent: 'school' });
  const housing = resolveIntentRiskTier({ domainIntent: 'housing' });
  const general = resolveIntentRiskTier({ domainIntent: 'general' });
  const unknown = resolveIntentRiskTier({ domainIntent: 'tax' });

  assert.equal(ssn.intentRiskTier, 'high');
  assert.equal(banking.intentRiskTier, 'high');
  assert.equal(school.intentRiskTier, 'medium');
  assert.equal(housing.intentRiskTier, 'medium');
  assert.equal(general.intentRiskTier, 'low');
  assert.equal(unknown.intentRiskTier, 'low');
  assert.equal(unknown.domainIntent, 'general');
});

test('phase748: resolveIntentRiskTier normalizes and deduplicates reason codes', () => {
  const snapshot = resolveIntentRiskTier({
    domainIntent: 'ssn',
    reasonCodes: ['  NEED REVIEW ', 'need review', '']
  });
  assert.equal(snapshot.intentRiskTier, 'high');
  assert.ok(Array.isArray(snapshot.riskReasonCodes));
  assert.ok(snapshot.riskReasonCodes.includes('intent_ssn'));
  assert.ok(snapshot.riskReasonCodes.includes('risk_high'));
  assert.ok(snapshot.riskReasonCodes.includes('need_review'));
});
