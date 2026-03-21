'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { __testOnly } = require('../../src/routes/webhookLine');

test('phase760: semantic reply envelope suppresses auto quick replies for concierge while keeping safety metadata', () => {
  const envelope = __testOnly.buildSemanticReplyEnvelope({
    replyText: '結論です。\n1. SSNの書類を確認します。',
    domainIntent: 'ssn',
    conversationMode: 'concierge',
    eventSource: { type: 'group', groupId: 'G1' },
    pathType: 'slow',
    nextSteps: ['必要書類を確認する', '予約方法を確認する'],
    followupQuestion: 'どの州ですか？',
    memoryReadScopes: ['profile_memory', 'session_memory'],
    memoryWriteScopes: ['profile_memory', 'compliance_memory'],
    warnings: ['existing_warning'],
    legalSnapshot: {
      policySource: 'system_flags',
      legalDecision: 'review',
      legalReasonCodes: ['regulated_topic']
    },
    sourceAuthorityScore: 0.4,
    sourceFreshnessScore: 0.3,
    sourceReadinessDecision: 'clarify',
    readinessDecision: 'clarify',
    readinessReasonCodes: ['stale_source_detected'],
    officialOnlySatisfied: false,
    regulatedLane: true,
    escalationRequired: true
  });

  assert.equal(envelope.responseContractConformance.conformant, true);
  assert.equal(envelope.semanticResponseObject.group_privacy_mode, 'group_safe');
  assert.deepEqual(envelope.semanticResponseObject.memory_read_scopes, ['session_memory']);
  assert.deepEqual(envelope.semanticResponseObject.memory_write_scopes, ['compliance_memory']);
  assert.equal(envelope.semanticResponseObject.citation_summary.finalized, true);
  assert.equal(envelope.semanticResponseObject.citation_summary.disclaimer_required, true);
  assert.equal(envelope.semanticResponseObject.policy_trace.escalation_required, true);
  assert.ok(envelope.semanticResponseObject.warnings.includes('group_privacy_guard_active'));
  assert.ok(envelope.semanticResponseObject.warnings.includes('citation_disclaimer_required'));
  assert.equal(envelope.lineSurfacePlan.surface, 'text');
  assert.equal(envelope.lineMessage.type, 'text');
  assert.equal(envelope.lineMessage.quickReply, undefined);
});

test('phase760: semantic reply envelope keeps explicit quick replies even in concierge mode', () => {
  const envelope = __testOnly.buildSemanticReplyEnvelope({
    replyText: '結論です。',
    domainIntent: 'general',
    conversationMode: 'concierge',
    nextSteps: ['必要書類を確認する'],
    quickReplies: [
      { label: '必要書類', text: '必要書類を教えて' },
      { label: '予約', text: '予約が必要か教えて' }
    ]
  });

  assert.equal(envelope.lineSurfacePlan.surface, 'quick_reply');
  assert.equal(envelope.lineMessage.type, 'text');
  assert.ok(envelope.lineMessage.quickReply);
  assert.equal(envelope.lineMessage.quickReply.items.length, 2);
});
