'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { sanitizeLlmAuditPayload } = require('../../src/domain/audit/llmAuditPayloadGuard');

test('phase720: llm audit sink guard drops non-allowlisted payloadSummary keys', () => {
  const sanitized = sanitizeLlmAuditPayload({
    actor: 'admin_app',
    action: 'llm_gate.decision',
    traceId: 'trace_phase720_guard',
    requestId: 'req_phase720_guard',
    payloadSummary: {
      decision: 'allow',
      entryType: 'webhook',
      conversationMode: 'casual',
      routerReason: 'greeting_detected',
      intentRiskTier: 'low',
      riskReasonCodes: ['intent_general', 'risk_low'],
      readinessDecision: 'allow',
      readinessReasonCodes: ['readiness_allow'],
      readinessSafeResponseMode: 'answer',
      unsupportedClaimCount: 0,
      contradictionDetected: false,
      answerReadinessLogOnly: true,
      fullReplyText: 'should_not_be_saved',
      rawPrompt: 'should_not_be_saved',
      rawKbBodies: ['drop'],
      fullRequestBody: { drop: true },
      unknownField: 'drop'
    },
    unknownTopLevel: 'drop'
  });

  assert.equal(sanitized.action, 'llm_gate.decision');
  assert.equal(sanitized.payloadSummary.decision, 'allow');
  assert.equal(sanitized.payloadSummary.entryType, 'webhook');
  assert.equal(sanitized.payloadSummary.conversationMode, 'casual');
  assert.equal(sanitized.payloadSummary.routerReason, 'greeting_detected');
  assert.equal(sanitized.payloadSummary.intentRiskTier, 'low');
  assert.deepEqual(sanitized.payloadSummary.riskReasonCodes, ['intent_general', 'risk_low']);
  assert.equal(sanitized.payloadSummary.readinessDecision, 'allow');
  assert.deepEqual(sanitized.payloadSummary.readinessReasonCodes, ['readiness_allow']);
  assert.equal(sanitized.payloadSummary.readinessSafeResponseMode, 'answer');
  assert.equal(sanitized.payloadSummary.unsupportedClaimCount, 0);
  assert.equal(sanitized.payloadSummary.contradictionDetected, false);
  assert.equal(sanitized.payloadSummary.answerReadinessLogOnly, true);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized.payloadSummary, 'fullReplyText'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized.payloadSummary, 'rawPrompt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized.payloadSummary, 'rawKbBodies'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized.payloadSummary, 'fullRequestBody'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized.payloadSummary, 'unknownField'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'unknownTopLevel'), false);
  assert.ok(Number.isFinite(Number(sanitized.payloadSummary._droppedKeyCount)));
  assert.ok(Array.isArray(sanitized.payloadSummary._droppedKeysSample));
  assert.ok(sanitized.payloadSummary._droppedKeyCount >= 4);
});

test('phase720: llm audit sink guard keeps non-llm actions untouched', () => {
  const source = {
    actor: 'admin_app',
    action: 'ops_console.view',
    traceId: 'trace_phase720_non_llm',
    payloadSummary: {
      anyKey: 'keep'
    },
    unknownTopLevel: 'keep'
  };
  const sanitized = sanitizeLlmAuditPayload(source);
  assert.equal(sanitized.action, 'ops_console.view');
  assert.equal(sanitized.payloadSummary.anyKey, 'keep');
  assert.equal(sanitized.unknownTopLevel, 'keep');
});
