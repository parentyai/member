'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  handleConsentStatus,
  handleConsentVerify,
  handleConsentRevoke
} = require('../../src/routes/admin/llmConsent');

function makeReq(headers) {
  return {
    headers: Object.assign({
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_trace',
      'x-request-id': 'phase900_request'
    }, headers || {})
  };
}

function makeRes() {
  const headers = {};
  return {
    statusCode: 0,
    body: null,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
    },
    writeHead(code, nextHeaders) {
      this.statusCode = code;
      Object.assign(headers, nextHeaders || {});
    },
    end(data) {
      this.body = JSON.parse(data);
    },
    getHeader(name) {
      return headers[String(name).toLowerCase()];
    }
  };
}

function makeDeps(policyOverrides) {
  let stored = Object.assign({
    lawfulBasis: 'unspecified',
    consentVerified: false,
    crossBorder: false
  }, policyOverrides || {});
  return {
    getLlmPolicy: async () => Object.assign({}, stored),
    setLlmPolicy: async (policy) => {
      stored = Object.assign({}, policy);
      return { id: 'phase0', llmPolicy: stored };
    },
    appendAuditLog: async () => ({ id: 'audit-1' })
  };
}

test('phase900: llm consent status success emits completed outcome metadata', async () => {
  const res = makeRes();
  await handleConsentStatus(makeReq(), res, makeDeps({ lawfulBasis: 'consent', consentVerified: false }));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.outcome && res.body.outcome.state, 'success');
  assert.equal(res.body.outcome && res.body.outcome.reason, 'completed');
  assert.equal(res.body.outcome && res.body.outcome.guard && res.body.outcome.guard.routeKey, 'admin.llm_consent_status');
  assert.equal(res.getHeader('x-member-outcome-state'), 'success');
  assert.equal(res.getHeader('x-member-outcome-route-type'), 'admin_route');
});

test('phase900: llm consent verify blocked emits lawful_basis_not_consent outcome metadata', async () => {
  const res = makeRes();
  await handleConsentVerify(makeReq(), res, makeDeps({ lawfulBasis: 'contract', consentVerified: false }));

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.reason, 'lawful_basis_not_consent');
  assert.equal(res.body.outcome && res.body.outcome.state, 'blocked');
  assert.equal(res.body.outcome && res.body.outcome.reason, 'lawful_basis_not_consent');
  assert.equal(res.body.outcome && res.body.outcome.guard && res.body.outcome.guard.routeKey, 'admin.llm_consent_verify');
  assert.equal(res.getHeader('x-member-outcome-state'), 'blocked');
});

test('phase900: llm consent verify success emits completed outcome metadata', async () => {
  const res = makeRes();
  await handleConsentVerify(makeReq(), res, makeDeps({ lawfulBasis: 'consent', consentVerified: false }));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.consentVerified, true);
  assert.equal(res.body.outcome && res.body.outcome.state, 'success');
  assert.equal(res.body.outcome && res.body.outcome.reason, 'completed');
  assert.equal(res.body.outcome && res.body.outcome.guard && res.body.outcome.guard.routeKey, 'admin.llm_consent_verify');
});

test('phase900: llm consent revoke success emits completed outcome metadata', async () => {
  const res = makeRes();
  await handleConsentRevoke(makeReq(), res, makeDeps({ lawfulBasis: 'consent', consentVerified: true }));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.consentVerified, false);
  assert.equal(res.body.outcome && res.body.outcome.state, 'success');
  assert.equal(res.body.outcome && res.body.outcome.reason, 'completed');
  assert.equal(res.body.outcome && res.body.outcome.guard && res.body.outcome.guard.routeKey, 'admin.llm_consent_revoke');
});
