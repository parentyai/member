'use strict';

const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');

const SOURCE_BLOCK_REASONS = Object.freeze({
  SOURCE_EXPIRED: 'SOURCE_EXPIRED',
  SOURCE_DEAD: 'SOURCE_DEAD',
  SOURCE_BLOCKED: 'SOURCE_BLOCKED',
  SOURCE_POLICY_BLOCKED: 'SOURCE_POLICY_BLOCKED'
});

function normalizeRequiredLevel(value) {
  const requiredLevel = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return requiredLevel === 'optional' ? 'optional' : 'required';
}

function normalizePackClass(value) {
  const packClass = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return packClass === 'nationwide' ? 'nationwide' : 'regional';
}

function normalizeSourceType(value) {
  const sourceType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return sourceType || 'other';
}

function normalizeAuthorityLevel(value) {
  const authorityLevel = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return authorityLevel || 'other';
}

function normalizeNationwidePolicy(value) {
  const policy = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return policy || 'federal_only';
}

function normalizeLanguage(value) {
  const language = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return language || 'ja';
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

function resolvePolicyFailure(ref, packClass) {
  if (packClass !== 'nationwide') return null;
  if (!ref) return { category: SOURCE_BLOCK_REASONS.SOURCE_POLICY_BLOCKED, reason: 'source_not_found' };
  const sourceType = normalizeSourceType(ref.sourceType);
  if (sourceType !== 'official' && sourceType !== 'semi_official') {
    return { category: SOURCE_BLOCK_REASONS.SOURCE_POLICY_BLOCKED, reason: 'nationwide_source_type_invalid' };
  }
  const authorityLevel = normalizeAuthorityLevel(ref.authorityLevel);
  if (authorityLevel !== 'federal') {
    return { category: SOURCE_BLOCK_REASONS.SOURCE_POLICY_BLOCKED, reason: 'nationwide_authority_invalid' };
  }
  return null;
}

function pickBlockedCategory(failures) {
  if (!Array.isArray(failures) || !failures.length) return null;
  if (failures.some((item) => item.category === SOURCE_BLOCK_REASONS.SOURCE_EXPIRED)) return SOURCE_BLOCK_REASONS.SOURCE_EXPIRED;
  if (failures.some((item) => item.category === SOURCE_BLOCK_REASONS.SOURCE_DEAD)) return SOURCE_BLOCK_REASONS.SOURCE_DEAD;
  if (failures.some((item) => item.category === SOURCE_BLOCK_REASONS.SOURCE_POLICY_BLOCKED)) return SOURCE_BLOCK_REASONS.SOURCE_POLICY_BLOCKED;
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
  const packClass = normalizePackClass(payload.packClass);
  const nationwidePolicy = normalizeNationwidePolicy(payload.nationwidePolicy);
  const language = normalizeLanguage(payload.language);
  const getSourceRef = deps && deps.getSourceRef ? deps.getSourceRef : sourceRefsRepo.getSourceRef;

  const sources = [];
  const failures = [];
  const blockingFailures = [];
  const optionalFailures = [];
  const policyGuardViolations = [];
  if (packClass === 'nationwide') {
    if (nationwidePolicy !== 'federal_only') {
      const violation = {
        sourceRefId: null,
        requiredLevel: 'required',
        category: SOURCE_BLOCK_REASONS.SOURCE_POLICY_BLOCKED,
        reason: 'nationwide_policy_invalid',
        status: null,
        validUntil: null
      };
      policyGuardViolations.push(violation);
      failures.push(violation);
      blockingFailures.push(violation);
    }
    if (!language) {
      const violation = {
        sourceRefId: null,
        requiredLevel: 'required',
        category: SOURCE_BLOCK_REASONS.SOURCE_POLICY_BLOCKED,
        reason: 'nationwide_language_missing',
        status: null,
        validUntil: null
      };
      policyGuardViolations.push(violation);
      failures.push(violation);
      blockingFailures.push(violation);
    }
  }
  for (const sourceRefId of sourceRefIds) {
    const ref = await getSourceRef(sourceRefId);
    const requiredLevel = normalizeRequiredLevel(ref && ref.requiredLevel);
    sources.push({ sourceRefId, ref: ref || null });
    const baseFailure = resolveFailure(ref, nowMs);
    if (baseFailure) {
      const failureItem = {
        sourceRefId,
        requiredLevel,
        category: baseFailure.category,
        reason: baseFailure.reason,
        status: ref && ref.status ? ref.status : null,
        validUntil: ref && ref.validUntil ? ref.validUntil : null
      };
      failures.push(failureItem);
      if (requiredLevel === 'optional') optionalFailures.push(failureItem);
      else blockingFailures.push(failureItem);
      continue;
    }
    const policyFailure = resolvePolicyFailure(ref, packClass);
    if (!policyFailure) continue;
    const policyFailureItem = {
      sourceRefId,
      requiredLevel,
      category: policyFailure.category,
      reason: policyFailure.reason,
      status: ref && ref.status ? ref.status : null,
      validUntil: ref && ref.validUntil ? ref.validUntil : null
    };
    failures.push(policyFailureItem);
    // nationwide policy violations are always blocking (fail-closed).
    blockingFailures.push(policyFailureItem);
  }

  const blockedReasonCategory = pickBlockedCategory(blockingFailures);
  return {
    ok: blockingFailures.length === 0,
    sourceRefs: sources,
    invalidSourceRefs: failures,
    blockingInvalidSourceRefs: blockingFailures,
    optionalInvalidSourceRefs: optionalFailures,
    policyGuardViolations,
    policyInvalidSourceRefs: failures.filter((item) => item.category === SOURCE_BLOCK_REASONS.SOURCE_POLICY_BLOCKED),
    blockedReasonCategory,
    blocked: blockingFailures.length > 0
  };
}

module.exports = {
  SOURCE_BLOCK_REASONS,
  validateCityPackSources
};
