'use strict';

const userConsentsRepo = require('../../repos/firestore/userConsentsRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');

const LLM_CONSENT_VERSION = userConsentsRepo.LLM_CONSENT_VERSION;

async function recordUserLlmConsent(params, deps) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  if (!lineUserId || typeof lineUserId !== 'string') throw new Error('lineUserId required');

  const accepted = payload.accepted === true;
  const consentVersion = typeof payload.consentVersion === 'string' && payload.consentVersion.trim()
    ? payload.consentVersion.trim()
    : LLM_CONSENT_VERSION;
  const traceId = payload.traceId || null;
  const actor = payload.actor || 'line_user';

  const setFn = deps && deps.setUserLlmConsent ? deps.setUserLlmConsent : userConsentsRepo.setUserLlmConsent;
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;

  const result = await setFn(lineUserId, accepted, consentVersion);
  const llmConsentStatus = result.llmConsentStatus;

  const action = accepted ? 'user_llm_consent.accept' : 'user_llm_consent.revoke';
  await auditFn({
    actor,
    action,
    entityType: 'user_consent',
    entityId: lineUserId,
    lineUserId,
    traceId,
    payloadSummary: {
      lineUserId,
      llmConsentStatus,
      llmConsentVersion: consentVersion,
      accepted
    }
  }).catch(() => null);

  return {
    ok: true,
    lineUserId,
    llmConsentStatus,
    llmConsentVersion: consentVersion
  };
}

module.exports = {
  recordUserLlmConsent,
  LLM_CONSENT_VERSION
};
