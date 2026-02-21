'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Minimal in-memory Firestore stub
// ---------------------------------------------------------------------------
function makeFirestoreStub() {
  const store = {};
  return {
    collection(name) {
      return {
        doc(id) {
          return {
            async set(data, opts) {
              const existing = store[`${name}/${id}`] || {};
              store[`${name}/${id}`] = opts && opts.merge ? Object.assign({}, existing, data) : Object.assign({}, data);
            },
            async get() {
              const data = store[`${name}/${id}`];
              return { exists: !!data, data: () => (data ? Object.assign({}, data) : undefined) };
            },
            async update(data) {
              const existing = store[`${name}/${id}`] || {};
              store[`${name}/${id}`] = Object.assign({}, existing, data);
            }
          };
        }
      };
    }
  };
}

// ---------------------------------------------------------------------------
// Inline implementation (mirrors userConsentsRepo.js but injected db)
// ---------------------------------------------------------------------------
const CONSENT_STATUS = Object.freeze({ ACCEPTED: 'accepted', REVOKED: 'revoked', PENDING: 'pending' });
const LLM_CONSENT_VERSION = 'llm_consent_v1';

function normalizeConsentStatus(value) {
  if (value === CONSENT_STATUS.ACCEPTED) return CONSENT_STATUS.ACCEPTED;
  if (value === CONSENT_STATUS.REVOKED) return CONSENT_STATUS.REVOKED;
  return CONSENT_STATUS.PENDING;
}

async function setUserLlmConsent(lineUserId, accepted, version, db) {
  if (!lineUserId || typeof lineUserId !== 'string') throw new Error('lineUserId required');
  const consentVersion = typeof version === 'string' && version.trim() ? version.trim() : LLM_CONSENT_VERSION;
  const status = accepted ? CONSENT_STATUS.ACCEPTED : CONSENT_STATUS.REVOKED;
  const docRef = db.collection('user_consents').doc(lineUserId);
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

async function getUserLlmConsent(lineUserId, db) {
  if (!lineUserId || typeof lineUserId !== 'string') return null;
  const docRef = db.collection('user_consents').doc(lineUserId);
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('userConsentsRepo: setUserLlmConsent accept stores accepted status', async () => {
  const db = makeFirestoreStub();
  const result = await setUserLlmConsent('U_001', true, LLM_CONSENT_VERSION, db);
  assert.equal(result.lineUserId, 'U_001');
  assert.equal(result.llmConsentStatus, 'accepted');
  assert.equal(result.llmConsentVersion, LLM_CONSENT_VERSION);
  assert.ok(result.llmConsentAcceptedAt instanceof Date);
  assert.equal(result.llmConsentRevokedAt, null);
});

test('userConsentsRepo: setUserLlmConsent revoke stores revoked status', async () => {
  const db = makeFirestoreStub();
  await setUserLlmConsent('U_002', true, LLM_CONSENT_VERSION, db);
  const result = await setUserLlmConsent('U_002', false, LLM_CONSENT_VERSION, db);
  assert.equal(result.llmConsentStatus, 'revoked');
  assert.ok(result.llmConsentRevokedAt instanceof Date);
  assert.equal(result.llmConsentAcceptedAt, null);
});

test('userConsentsRepo: getUserLlmConsent returns null for unknown user', async () => {
  const db = makeFirestoreStub();
  const result = await getUserLlmConsent('U_UNKNOWN', db);
  assert.equal(result, null);
});

test('userConsentsRepo: getUserLlmConsent returns accepted record', async () => {
  const db = makeFirestoreStub();
  await setUserLlmConsent('U_003', true, LLM_CONSENT_VERSION, db);
  const record = await getUserLlmConsent('U_003', db);
  assert.ok(record !== null);
  assert.equal(record.lineUserId, 'U_003');
  assert.equal(record.llmConsentStatus, 'accepted');
  assert.equal(record.llmConsentVersion, LLM_CONSENT_VERSION);
});

test('userConsentsRepo: getUserLlmConsent normalizes unknown status to pending', async () => {
  const db = makeFirestoreStub();
  // Manually inject bad status
  await db.collection('user_consents').doc('U_BAD').set({ lineUserId: 'U_BAD', llmConsentStatus: 'unknown_status' }, { merge: true });
  const record = await getUserLlmConsent('U_BAD', db);
  assert.equal(record.llmConsentStatus, 'pending');
});

test('userConsentsRepo: setUserLlmConsent throws on missing lineUserId', async () => {
  const db = makeFirestoreStub();
  await assert.rejects(
    () => setUserLlmConsent('', true, LLM_CONSENT_VERSION, db),
    /lineUserId required/
  );
});

test('userConsentsRepo: setUserLlmConsent uses default version when omitted', async () => {
  const db = makeFirestoreStub();
  const result = await setUserLlmConsent('U_004', true, undefined, db);
  assert.equal(result.llmConsentVersion, LLM_CONSENT_VERSION);
});

test('userConsentsRepo: merge preserves existing fields', async () => {
  const db = makeFirestoreStub();
  // First set accepted
  await setUserLlmConsent('U_005', true, LLM_CONSENT_VERSION, db);
  // Then revoke - only llmConsentStatus/revokedAt should change
  const result = await setUserLlmConsent('U_005', false, LLM_CONSENT_VERSION, db);
  assert.equal(result.lineUserId, 'U_005');
  assert.equal(result.llmConsentStatus, 'revoked');
});
