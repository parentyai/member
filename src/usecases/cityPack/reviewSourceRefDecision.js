'use strict';

const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');

const VALID_DECISIONS = new Set(['confirm', 'retire', 'replace', 'manual-only']);
const EXTEND_DAYS = 120;

function addDays(baseDate, days) {
  const next = new Date(baseDate.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function reviewSourceRefDecision(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const sourceRefId = typeof payload.sourceRefId === 'string' ? payload.sourceRefId.trim() : '';
  const decision = typeof payload.decision === 'string' ? payload.decision.trim().toLowerCase() : '';
  if (!sourceRefId) throw new Error('sourceRefId required');
  if (!VALID_DECISIONS.has(decision)) throw new Error('invalid decision');

  const actor = payload.actor || 'unknown';
  const traceId = payload.traceId || null;
  const requestId = payload.requestId || null;
  const now = payload.now instanceof Date ? payload.now : new Date();

  const getSourceRef = deps && deps.getSourceRef ? deps.getSourceRef : sourceRefsRepo.getSourceRef;
  const updateSourceRef = deps && deps.updateSourceRef ? deps.updateSourceRef : sourceRefsRepo.updateSourceRef;
  const audit = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;

  const sourceRef = await getSourceRef(sourceRefId);
  if (!sourceRef) {
    return { ok: false, reason: 'source_ref_not_found', sourceRefId, traceId };
  }

  let patch = null;
  const payloadSummary = { decision, sourceRefId };

  if (decision === 'confirm') {
    patch = {
      status: 'active',
      validUntil: addDays(now, EXTEND_DAYS),
      lastResult: 'ok'
    };
    payloadSummary.validUntil = patch.validUntil.toISOString();
  } else if (decision === 'retire') {
    patch = { status: 'retired' };
    if (Array.isArray(sourceRef.usedByCityPackIds) && sourceRef.usedByCityPackIds.length > 0) {
      payloadSummary.warning = 'city_pack_reference_exists';
      payloadSummary.usedByCityPackIds = sourceRef.usedByCityPackIds;
    }
  } else if (decision === 'replace') {
    const replacementUrl = typeof payload.replacementUrl === 'string' ? payload.replacementUrl.trim() : '';
    if (!replacementUrl) return { ok: false, reason: 'replacement_url_required', sourceRefId, traceId };
    patch = {
      url: replacementUrl,
      status: 'needs_review',
      validFrom: now,
      validUntil: addDays(now, EXTEND_DAYS),
      lastResult: 'diff_detected'
    };
    payloadSummary.replacementUrl = replacementUrl;
  } else {
    patch = {
      status: 'blocked',
      riskLevel: 'high'
    };
  }

  await updateSourceRef(sourceRefId, patch);
  await audit({
    actor,
    action: `source_ref.review.${decision}`,
    entityType: 'source_ref',
    entityId: sourceRefId,
    traceId,
    requestId,
    payloadSummary
  });

  return {
    ok: true,
    sourceRefId,
    decision,
    status: patch.status,
    validUntil: patch.validUntil || null,
    warning: payloadSummary.warning || null,
    traceId
  };
}

module.exports = {
  reviewSourceRefDecision,
  EXTEND_DAYS
};
