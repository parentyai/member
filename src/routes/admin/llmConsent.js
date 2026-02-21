'use strict';

const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveTraceId, resolveRequestId } = require('./osContext');

// Consent verify is only valid when lawfulBasis is already set to 'consent'.
// Revoking consent is always allowed (sets consentVerified = false).
// Neither operation requires the plan/confirmToken ceremony — admin auth is sufficient.

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

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    lawfulBasis: policy.lawfulBasis,
    consentVerified,
    consentRequired,
    guideModeLocked
  }));
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
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: false,
      reason: 'lawful_basis_not_consent',
      lawfulBasis: policy.lawfulBasis,
      traceId
    }));
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

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    lawfulBasis: updated.lawfulBasis,
    consentVerified: true,
    guideModeLocked: false
  }));
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

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    lawfulBasis: updated.lawfulBasis,
    consentVerified: false,
    guideModeLocked: updated.lawfulBasis === 'consent'
  }));
}

module.exports = {
  handleConsentStatus,
  handleConsentVerify,
  handleConsentRevoke
};
