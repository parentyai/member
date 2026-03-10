'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveSharedAnswerReadiness } = require('../../src/domain/llm/quality/resolveSharedAnswerReadiness');

test('phase778: shared readiness helper computes decision and returns normalized reply text', () => {
  const result = resolveSharedAnswerReadiness({
    domainIntent: 'ssn',
    llmUsed: false,
    replyText: 'ok',
    lawfulBasis: 'consent',
    consentVerified: true,
    legalDecision: 'allow',
    sourceReadinessDecision: 'clarify'
  });

  assert.equal(typeof result.readiness.decision, 'string');
  assert.ok(Array.isArray(result.readiness.reasonCodes));
  assert.equal(result.intentRiskTier, 'high');
  assert.equal(typeof result.replyText, 'string');
});

test('phase778: explicit readiness decision overrides computed decision', () => {
  const result = resolveSharedAnswerReadiness({
    domainIntent: 'general',
    llmUsed: true,
    replyText: '回答です',
    readinessDecision: 'hedged',
    readinessReasonCodes: ['manual_override'],
    readinessSafeResponseMode: 'answer_with_hedge'
  });

  assert.equal(result.readiness.decision, 'hedged');
  assert.deepEqual(result.readiness.reasonCodes, ['manual_override']);
  assert.equal(result.readiness.safeResponseMode, 'answer_with_hedge');
});

test('phase778: shared readiness helper enforces action gateway decision when enabled', () => {
  const result = resolveSharedAnswerReadiness({
    domainIntent: 'general',
    llmUsed: true,
    replyText: '回答です',
    actionGatewayEnabled: true,
    actionClass: 'assist',
    toolName: 'assist',
    confirmationToken: ''
  });

  assert.equal(result.actionGateway.enabled, true);
  assert.equal(result.actionGateway.actionClass, 'assist');
  assert.equal(result.actionGateway.allowed, false);
  assert.equal(result.actionGateway.decision, 'clarify');
  assert.equal(result.actionGateway.reason, 'assist_confirmation_required');
  assert.equal(result.readiness.decision, 'clarify');
});
