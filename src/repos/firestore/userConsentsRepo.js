'use strict';

const { getDb } = require('../../infra/firestore');

const COLLECTION = 'user_consents';
const LLM_CONSENT_VERSION = 'llm_consent_v1';

// Consent statuses
const CONSENT_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  REVOKED: 'revoked',
  PENDING: 'pending'
});

function normalizeConsentStatus(value) {
  if (value === CONSENT_STATUS.ACCEPTED) return CONSENT_STATUS.ACCEPTED;
  if (value === CONSENT_STATUS.REVOKED) return CONSENT_STATUS.REVOKED;
  return CONSENT_STATUS.PENDING;
}

async function setUserLlmConsent(lineUserId, accepted, version) {
  if (!lineUserId || typeof lineUserId !== 'string') throw new Error('lineUserId required');
  const consentVersion = typeof version === 'string' && version.trim() ? version.trim() : LLM_CONSENT_VERSION;
  const status = accepted ? CONSENT_STATUS.ACCEPTED : CONSENT_STATUS.REVOKED;
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(lineUserId);
  const now = new Date();
  const patch = {
    lineUserId,
    llmConsentStatus: status,
    llmConsentVersion: consentVersion,
    llmConsentAcceptedAt: accepted ? now : null,
    llmConsentRevokedAt: accepted ? null : now,
    updatedAt: now
  };
  await docRef.set(patch, { merge: true });
  return Object.assign({ id: lineUserId }, patch);
}

async function getUserLlmConsent(lineUserId) {
  if (!lineUserId || typeof lineUserId !== 'string') return null;
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(lineUserId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return {
    id: lineUserId,
    lineUserId,
    llmConsentStatus: normalizeConsentStatus(data.llmConsentStatus),
    llmConsentVersion: typeof data.llmConsentVersion === 'string' ? data.llmConsentVersion : null,
    llmConsentAcceptedAt: data.llmConsentAcceptedAt || null,
    llmConsentRevokedAt: data.llmConsentRevokedAt || null,
    updatedAt: data.updatedAt || null
  };
}

module.exports = {
  LLM_CONSENT_VERSION,
  CONSENT_STATUS,
  setUserLlmConsent,
  getUserLlmConsent
};
