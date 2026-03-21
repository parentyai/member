'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateRequiredCoreFactsGate } = require('../../src/domain/llm/policy/evaluateRequiredCoreFactsGate');
const { evaluateAnswerReadiness } = require('../../src/domain/llm/quality/evaluateAnswerReadiness');

test('phase790: required core facts gate clarifies high-risk answers when critical facts are missing', () => {
  const gate = evaluateRequiredCoreFactsGate({
    contextSnapshot: {
      location: {
        state: 'NY',
        city: 'New York'
      },
      family: {
        spouse: true,
        kidsAges: [8]
      }
    },
    domainIntent: 'ssn',
    intentRiskTier: 'high',
    strategy: 'grounded_answer',
    actionClass: 'lookup'
  });

  assert.equal(gate.decision, 'clarify');
  assert.equal(gate.logOnly, false);
  assert.equal(gate.missingFacts.includes('primary_visa_class'), true);
  assert.equal(gate.criticalMissingFacts.includes('primary_visa_class'), true);
});

test('phase790: required core facts gate stays log-only when snapshot is missing', () => {
  const gate = evaluateRequiredCoreFactsGate({
    contextSnapshot: null,
    domainIntent: 'banking',
    intentRiskTier: 'high',
    strategy: 'grounded_answer',
    actionClass: 'assist'
  });

  assert.equal(gate.decision, 'allow');
  assert.equal(gate.logOnly, true);
  assert.ok(gate.reasonCodes.includes('core_facts_snapshot_missing'));
});

test('phase790: answer readiness consumes required-core-facts signal', () => {
  const readiness = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'high',
    sourceAuthorityScore: 0.9,
    sourceFreshnessScore: 0.9,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    evidenceCoverage: 0.9,
    requiredCoreFactsComplete: false,
    requiredCoreFactsDecision: 'clarify',
    requiredCoreFactsLogOnly: false,
    missingRequiredCoreFactsCount: 4,
    requiredCoreFactsMissing: ['primary_visa_class', 'assignment_start_date']
  });

  assert.equal(readiness.decision, 'clarify');
  assert.ok(readiness.reasonCodes.includes('missing_required_core_facts'));
  assert.equal(readiness.qualitySnapshot.requiredCoreFactsDecision, 'clarify');
});

test('phase790: general concierge planning stays log-only even when core facts are sparse', () => {
  const gate = evaluateRequiredCoreFactsGate({
    contextSnapshot: {
      topOpenTasks: [{ key: 'school_registration', status: 'open' }]
    },
    domainIntent: 'general',
    intentRiskTier: 'low',
    strategy: 'domain_concierge',
    actionClass: 'draft',
    followupIntent: 'next_step'
  });

  assert.equal(gate.decision, 'allow');
  assert.equal(gate.logOnly, true);
  assert.ok(gate.reasonCodes.includes('core_facts_log_only'));
});
