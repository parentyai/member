'use strict';

const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');

const SOURCE_BLOCK_REASONS = Object.freeze({
  SOURCE_EXPIRED: 'SOURCE_EXPIRED',
  SOURCE_DEAD: 'SOURCE_DEAD',
  SOURCE_BLOCKED: 'SOURCE_BLOCKED'
});

function normalizeRequiredLevel(value) {
  const requiredLevel = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return requiredLevel === 'optional' ? 'optional' : 'required';
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function resolveFailure(ref, nowMs) {
  if (!ref) return { category: SOURCE_BLOCK_REASONS.SOURCE_BLOCKED, reason: 'source_not_found' };
  const status = typeof ref.status === 'string' ? ref.status.toLowerCase() : '';
  if (status === 'dead') return { category: SOURCE_BLOCK_REASONS.SOURCE_DEAD, reason: 'source_dead' };
  if (status === 'blocked' || status === 'retired') return { category: SOURCE_BLOCK_REASONS.SOURCE_BLOCKED, reason: 'source_blocked' };
  if (status !== 'active') return { category: SOURCE_BLOCK_REASONS.SOURCE_BLOCKED, reason: 'source_not_active' };
  const validUntilMs = toMillis(ref.validUntil);
  if (!validUntilMs || validUntilMs <= nowMs) {
    return { category: SOURCE_BLOCK_REASONS.SOURCE_EXPIRED, reason: 'source_expired' };
  }
  return null;
}

function pickBlockedCategory(failures) {
  if (!Array.isArray(failures) || !failures.length) return null;
  if (failures.some((item) => item.category === SOURCE_BLOCK_REASONS.SOURCE_EXPIRED)) return SOURCE_BLOCK_REASONS.SOURCE_EXPIRED;
  if (failures.some((item) => item.category === SOURCE_BLOCK_REASONS.SOURCE_DEAD)) return SOURCE_BLOCK_REASONS.SOURCE_DEAD;
  return SOURCE_BLOCK_REASONS.SOURCE_BLOCKED;
}

async function validateCityPackSources(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const sourceRefIds = Array.isArray(payload.sourceRefs)
    ? payload.sourceRefs.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())
    : [];
  if (!sourceRefIds.length) throw new Error('sourceRefs required');

  const now = payload.now instanceof Date ? payload.now : new Date();
  const nowMs = now.getTime();
  const getSourceRef = deps && deps.getSourceRef ? deps.getSourceRef : sourceRefsRepo.getSourceRef;

  const sources = [];
  const failures = [];
  const blockingFailures = [];
  const optionalFailures = [];
  for (const sourceRefId of sourceRefIds) {
    const ref = await getSourceRef(sourceRefId);
    const requiredLevel = normalizeRequiredLevel(ref && ref.requiredLevel);
    sources.push({ sourceRefId, ref: ref || null });
    const failure = resolveFailure(ref, nowMs);
    if (!failure) continue;
    const failureItem = {
      sourceRefId,
      requiredLevel,
      category: failure.category,
      reason: failure.reason,
      status: ref && ref.status ? ref.status : null,
      validUntil: ref && ref.validUntil ? ref.validUntil : null
    };
    failures.push(failureItem);
    if (requiredLevel === 'optional') optionalFailures.push(failureItem);
    else blockingFailures.push(failureItem);
  }

  const blockedReasonCategory = pickBlockedCategory(blockingFailures);
  return {
    ok: blockingFailures.length === 0,
    sourceRefs: sources,
    invalidSourceRefs: failures,
    blockingInvalidSourceRefs: blockingFailures,
    optionalInvalidSourceRefs: optionalFailures,
    blockedReasonCategory,
    blocked: blockingFailures.length > 0
  };
}

module.exports = {
  SOURCE_BLOCK_REASONS,
  validateCityPackSources
};
