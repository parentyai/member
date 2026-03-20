'use strict';

const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveTraceId, resolveRequestId } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const STATUS_ROUTE_KEY = 'admin.llm_consent_status';
const VERIFY_ROUTE_KEY = 'admin.llm_consent_verify';
const REVOKE_ROUTE_KEY = 'admin.llm_consent_revoke';

// Consent verify is only valid when lawfulBasis is already set to 'consent'.
// Revoking consent is always allowed (sets consentVerified = false).
// Neither operation requires the plan/confirmToken ceremony — admin auth is sufficient.

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, routeKey, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleConsentStatus(req, res, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  const getLlmPolicy = deps && deps.getLlmPolicy ? deps.getLlmPolicy : systemFlagsRepo.getLlmPolicy;
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;

  const policy = await getLlmPolicy();
  const consentRequired = policy.lawfulBasis === 'consent';
  const consentVerified = Boolean(policy.consentVerified);
  const guideModeLocked = consentRequired && !consentVerified;

  await auditFn({
    actor,
    action: 'llm_consent.status.view',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: {
      lawfulBasis: policy.lawfulBasis,
      consentVerified,
      guideModeLocked
    }
  }).catch(() => null);

  writeJson(res, STATUS_ROUTE_KEY, 200, {
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    lawfulBasis: policy.lawfulBasis,
    consentVerified,
    consentRequired,
    guideModeLocked
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleConsentVerify(req, res, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  const getLlmPolicy = deps && deps.getLlmPolicy ? deps.getLlmPolicy : systemFlagsRepo.getLlmPolicy;
  const setLlmPolicy = deps && deps.setLlmPolicy ? deps.setLlmPolicy : systemFlagsRepo.setLlmPolicy;
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;

  const policy = await getLlmPolicy();

  if (policy.lawfulBasis !== 'consent') {
    await auditFn({
      actor,
      action: 'llm_consent.verify',
      entityType: 'system_flags',
      entityId: 'phase0',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'lawful_basis_not_consent',
        lawfulBasis: policy.lawfulBasis
      }
    }).catch(() => null);
    writeJson(res, VERIFY_ROUTE_KEY, 409, {
      ok: false,
      reason: 'lawful_basis_not_consent',
      lawfulBasis: policy.lawfulBasis,
      traceId
    }, {
      state: 'blocked',
      reason: 'lawful_basis_not_consent'
    });
    return;
  }

  const updated = { lawfulBasis: policy.lawfulBasis, consentVerified: true, crossBorder: policy.crossBorder };
  await setLlmPolicy(updated);

  await auditFn({
    actor,
    action: 'llm_consent.verify',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      lawfulBasis: updated.lawfulBasis,
      consentVerified: true,
      crossBorder: updated.crossBorder
    }
  }).catch(() => null);

  writeJson(res, VERIFY_ROUTE_KEY, 200, {
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    lawfulBasis: updated.lawfulBasis,
    consentVerified: true,
    guideModeLocked: false
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleConsentRevoke(req, res, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  const getLlmPolicy = deps && deps.getLlmPolicy ? deps.getLlmPolicy : systemFlagsRepo.getLlmPolicy;
  const setLlmPolicy = deps && deps.setLlmPolicy ? deps.setLlmPolicy : systemFlagsRepo.setLlmPolicy;
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;

  const policy = await getLlmPolicy();
  const updated = { lawfulBasis: policy.lawfulBasis, consentVerified: false, crossBorder: policy.crossBorder };
  await setLlmPolicy(updated);

  await auditFn({
    actor,
    action: 'llm_consent.revoke',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      lawfulBasis: updated.lawfulBasis,
      consentVerified: false,
      crossBorder: updated.crossBorder
    }
  }).catch(() => null);

  writeJson(res, REVOKE_ROUTE_KEY, 200, {
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    lawfulBasis: updated.lawfulBasis,
    consentVerified: false,
    guideModeLocked: updated.lawfulBasis === 'consent'
  }, {
    state: 'success',
    reason: 'completed'
  });
}

module.exports = {
  handleConsentStatus,
  handleConsentVerify,
  handleConsentRevoke
};
