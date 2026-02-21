'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleConsentStatus, handleConsentVerify, handleConsentRevoke } = require('../../src/routes/admin/llmConsent');

function makeMockReq(headers) {
  return {
    headers: Object.assign({ 'x-actor': 'admin_test', 'x-trace-id': 'tr-next3', 'x-request-id': 'req-next3' }, headers || {})
  };
}

function makeMockRes() {
  const res = { statusCode: 0, body: null };
  res.writeHead = (code) => { res.statusCode = code; };
  res.end = (data) => { res.body = JSON.parse(data); };
  return res;
}

function makeDeps(policyOverrides) {
  let stored = Object.assign(
    { lawfulBasis: 'unspecified', consentVerified: false, crossBorder: false },
    policyOverrides || {}
  );
  return {
    getLlmPolicy: async () => Object.assign({}, stored),
    setLlmPolicy: async (policy) => { stored = Object.assign({}, policy); return { id: 'phase0', llmPolicy: stored }; },
    appendAuditLog: async () => ({ id: 'audit-1' })
  };
}

// --- handleConsentStatus ---

test('consent status: returns guideModeLocked=false when lawfulBasis is not consent', async () => {
  const deps = makeDeps({ lawfulBasis: 'unspecified', consentVerified: false });
  const res = makeMockRes();
  await handleConsentStatus(makeMockReq(), res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.lawfulBasis, 'unspecified');
  assert.equal(res.body.consentVerified, false);
  assert.equal(res.body.consentRequired, false);
  assert.equal(res.body.guideModeLocked, false);
});

test('consent status: guideModeLocked=true when lawfulBasis=consent and unverified', async () => {
  const deps = makeDeps({ lawfulBasis: 'consent', consentVerified: false });
  const res = makeMockRes();
  await handleConsentStatus(makeMockReq(), res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.consentRequired, true);
  assert.equal(res.body.guideModeLocked, true);
});

test('consent status: guideModeLocked=false when lawfulBasis=consent and verified', async () => {
  const deps = makeDeps({ lawfulBasis: 'consent', consentVerified: true });
  const res = makeMockRes();
  await handleConsentStatus(makeMockReq(), res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.consentRequired, true);
  assert.equal(res.body.consentVerified, true);
  assert.equal(res.body.guideModeLocked, false);
});

// --- handleConsentVerify ---

test('consent verify: sets consentVerified=true when lawfulBasis=consent', async () => {
  const deps = makeDeps({ lawfulBasis: 'consent', consentVerified: false });
  const res = makeMockRes();
  await handleConsentVerify(makeMockReq(), res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.consentVerified, true);
  assert.equal(res.body.guideModeLocked, false);

  // Verify stored state changed
  const policy = await deps.getLlmPolicy();
  assert.equal(policy.consentVerified, true);
});

test('consent verify: returns 409 when lawfulBasis is not consent', async () => {
  const deps = makeDeps({ lawfulBasis: 'legitimate_interest', consentVerified: false });
  const res = makeMockRes();
  await handleConsentVerify(makeMockReq(), res, deps);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.reason, 'lawful_basis_not_consent');
  assert.equal(res.body.lawfulBasis, 'legitimate_interest');

  // State must NOT change
  const policy = await deps.getLlmPolicy();
  assert.equal(policy.consentVerified, false);
});

test('consent verify: returns 409 when lawfulBasis is unspecified', async () => {
  const deps = makeDeps({ lawfulBasis: 'unspecified', consentVerified: false });
  const res = makeMockRes();
  await handleConsentVerify(makeMockReq(), res, deps);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.reason, 'lawful_basis_not_consent');
});

test('consent verify: audit log is written on success', async () => {
  const auditedLogs = [];
  const deps = makeDeps({ lawfulBasis: 'consent', consentVerified: false });
  deps.appendAuditLog = async (entry) => { auditedLogs.push(entry); return { id: 'a1' }; };
  const res = makeMockRes();
  await handleConsentVerify(makeMockReq(), res, deps);
  assert.equal(res.statusCode, 200);
  assert.ok(auditedLogs.length > 0);
  const entry = auditedLogs[0];
  assert.equal(entry.action, 'llm_consent.verify');
  assert.equal(entry.payloadSummary.ok, true);
  assert.equal(entry.payloadSummary.consentVerified, true);
});

test('consent verify: audit log is written on failure (wrong lawfulBasis)', async () => {
  const auditedLogs = [];
  const deps = makeDeps({ lawfulBasis: 'contract', consentVerified: false });
  deps.appendAuditLog = async (entry) => { auditedLogs.push(entry); return { id: 'a2' }; };
  const res = makeMockRes();
  await handleConsentVerify(makeMockReq(), res, deps);
  assert.equal(res.statusCode, 409);
  assert.ok(auditedLogs.length > 0);
  const entry = auditedLogs[0];
  assert.equal(entry.action, 'llm_consent.verify');
  assert.equal(entry.payloadSummary.ok, false);
  assert.equal(entry.payloadSummary.reason, 'lawful_basis_not_consent');
});

// --- handleConsentRevoke ---

test('consent revoke: sets consentVerified=false regardless of lawfulBasis', async () => {
  const deps = makeDeps({ lawfulBasis: 'consent', consentVerified: true });
  const res = makeMockRes();
  await handleConsentRevoke(makeMockReq(), res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.consentVerified, false);
  assert.equal(res.body.guideModeLocked, true); // lawfulBasis=consent, so locked again

  const policy = await deps.getLlmPolicy();
  assert.equal(policy.consentVerified, false);
});

test('consent revoke: guideModeLocked=false when lawfulBasis is not consent', async () => {
  const deps = makeDeps({ lawfulBasis: 'legitimate_interest', consentVerified: true });
  const res = makeMockRes();
  await handleConsentRevoke(makeMockReq(), res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.consentVerified, false);
  assert.equal(res.body.guideModeLocked, false); // not consent-based, so not locked
});

test('consent revoke: audit log is written', async () => {
  const auditedLogs = [];
  const deps = makeDeps({ lawfulBasis: 'consent', consentVerified: true });
  deps.appendAuditLog = async (entry) => { auditedLogs.push(entry); return { id: 'a3' }; };
  const res = makeMockRes();
  await handleConsentRevoke(makeMockReq(), res, deps);
  assert.equal(res.statusCode, 200);
  assert.ok(auditedLogs.length > 0);
  const entry = auditedLogs[0];
  assert.equal(entry.action, 'llm_consent.revoke');
  assert.equal(entry.payloadSummary.ok, true);
  assert.equal(entry.payloadSummary.consentVerified, false);
});

// --- actor required ---

test('consent status: returns 400 when x-actor header is missing', async () => {
  const deps = makeDeps();
  const res = makeMockRes();
  await handleConsentStatus({ headers: {} }, res, deps);
  assert.ok(res.statusCode === 400 || res.statusCode === 401);
});

test('consent verify: returns 400 when x-actor header is missing', async () => {
  const deps = makeDeps({ lawfulBasis: 'consent', consentVerified: false });
  const res = makeMockRes();
  await handleConsentVerify({ headers: {} }, res, deps);
  assert.ok(res.statusCode === 400 || res.statusCode === 401);
});
