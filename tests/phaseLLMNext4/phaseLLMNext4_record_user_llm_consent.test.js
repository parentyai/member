'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recordUserLlmConsent } = require('../../src/usecases/llm/recordUserLlmConsent');

function makeDeps(overrides) {
  const auditedLogs = [];
  return Object.assign({
    setUserLlmConsent: async (lineUserId, accepted, version) => ({
      id: lineUserId,
      lineUserId,
      llmConsentStatus: accepted ? 'accepted' : 'revoked',
      llmConsentVersion: version || 'llm_consent_v1',
      llmConsentAcceptedAt: accepted ? new Date() : null,
      llmConsentRevokedAt: accepted ? null : new Date(),
      updatedAt: new Date()
    }),
    appendAuditLog: async (entry) => { auditedLogs.push(entry); return { id: 'audit-1' }; },
    _auditedLogs: auditedLogs
  }, overrides || {});
}

test('recordUserLlmConsent: accept returns ok with accepted status', async () => {
  const deps = makeDeps();
  const result = await recordUserLlmConsent({ lineUserId: 'U_A01', accepted: true }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.lineUserId, 'U_A01');
  assert.equal(result.llmConsentStatus, 'accepted');
  assert.equal(result.llmConsentVersion, 'llm_consent_v1');
});

test('recordUserLlmConsent: revoke returns ok with revoked status', async () => {
  const deps = makeDeps();
  const result = await recordUserLlmConsent({ lineUserId: 'U_A02', accepted: false }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmConsentStatus, 'revoked');
});

test('recordUserLlmConsent: throws when lineUserId missing', async () => {
  const deps = makeDeps();
  await assert.rejects(
    () => recordUserLlmConsent({ accepted: true }, deps),
    /lineUserId required/
  );
});

test('recordUserLlmConsent: throws when lineUserId is not a string', async () => {
  const deps = makeDeps();
  await assert.rejects(
    () => recordUserLlmConsent({ lineUserId: 123, accepted: true }, deps),
    /lineUserId required/
  );
});

test('recordUserLlmConsent: audit log written on accept with correct action', async () => {
  const deps = makeDeps();
  await recordUserLlmConsent({ lineUserId: 'U_A03', accepted: true, traceId: 'tr-001', actor: 'U_A03' }, deps);
  const logs = deps._auditedLogs;
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, 'user_llm_consent.accept');
  assert.equal(logs[0].entityType, 'user_consent');
  assert.equal(logs[0].entityId, 'U_A03');
  assert.equal(logs[0].lineUserId, 'U_A03');
  assert.equal(logs[0].traceId, 'tr-001');
  assert.equal(logs[0].payloadSummary.accepted, true);
  assert.equal(logs[0].payloadSummary.llmConsentStatus, 'accepted');
});

test('recordUserLlmConsent: audit log written on revoke with correct action', async () => {
  const deps = makeDeps();
  await recordUserLlmConsent({ lineUserId: 'U_A04', accepted: false, traceId: 'tr-002', actor: 'U_A04' }, deps);
  const logs = deps._auditedLogs;
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, 'user_llm_consent.revoke');
  assert.equal(logs[0].payloadSummary.accepted, false);
  assert.equal(logs[0].payloadSummary.llmConsentStatus, 'revoked');
});

test('recordUserLlmConsent: uses default LLM_CONSENT_VERSION when consentVersion omitted', async () => {
  const deps = makeDeps();
  const result = await recordUserLlmConsent({ lineUserId: 'U_A05', accepted: true }, deps);
  assert.equal(result.llmConsentVersion, 'llm_consent_v1');
});

test('recordUserLlmConsent: accepts custom consentVersion', async () => {
  const deps = makeDeps({
    setUserLlmConsent: async (lineUserId, accepted, version) => ({
      id: lineUserId,
      lineUserId,
      llmConsentStatus: accepted ? 'accepted' : 'revoked',
      llmConsentVersion: version,
      updatedAt: new Date()
    })
  });
  const result = await recordUserLlmConsent({ lineUserId: 'U_A06', accepted: true, consentVersion: 'llm_consent_v2' }, deps);
  assert.equal(result.llmConsentVersion, 'llm_consent_v2');
});

test('recordUserLlmConsent: default actor is line_user', async () => {
  const deps = makeDeps();
  await recordUserLlmConsent({ lineUserId: 'U_A07', accepted: true }, deps);
  const logs = deps._auditedLogs;
  assert.equal(logs[0].actor, 'line_user');
});

test('recordUserLlmConsent: audit failure does not throw (best-effort)', async () => {
  const deps = makeDeps({
    appendAuditLog: async () => { throw new Error('audit error'); }
  });
  // Should not throw
  const result = await recordUserLlmConsent({ lineUserId: 'U_A08', accepted: true }, deps);
  assert.equal(result.ok, true);
});
