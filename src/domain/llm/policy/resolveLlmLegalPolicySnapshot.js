'use strict';

const systemFlagsRepo = require('../../../repos/firestore/systemFlagsRepo');
const DEFAULT_POLICY_FALLBACK = Object.freeze({
  lawfulBasis: 'unspecified',
  consentVerified: false,
  crossBorder: false
});

const ALLOWED_LAWFUL_BASIS = new Set([
  'unspecified',
  'consent',
  'contract',
  'legal_obligation',
  'vital_interest',
  'public_task',
  'legitimate_interest'
]);

function resolveDefaultPolicy() {
  const fromRepo = systemFlagsRepo && systemFlagsRepo.DEFAULT_LLM_POLICY && typeof systemFlagsRepo.DEFAULT_LLM_POLICY === 'object'
    ? systemFlagsRepo.DEFAULT_LLM_POLICY
    : DEFAULT_POLICY_FALLBACK;
  return {
    lawfulBasis: typeof fromRepo.lawfulBasis === 'string' ? fromRepo.lawfulBasis : DEFAULT_POLICY_FALLBACK.lawfulBasis,
    consentVerified: fromRepo.consentVerified === true,
    crossBorder: fromRepo.crossBorder === true
  };
}

function fallbackNormalizePolicy(policy) {
  const payload = policy && typeof policy === 'object' ? policy : {};
  const defaults = resolveDefaultPolicy();
  const lawfulBasisCandidate = typeof payload.lawfulBasis === 'string'
    ? payload.lawfulBasis.trim().toLowerCase()
    : defaults.lawfulBasis;
  const lawfulBasis = ALLOWED_LAWFUL_BASIS.has(lawfulBasisCandidate)
    ? lawfulBasisCandidate
    : defaults.lawfulBasis;
  return {
    lawfulBasis,
    consentVerified: payload.consentVerified === true,
    crossBorder: payload.crossBorder === true
  };
}

function normalizeReasonCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((item) => {
    if (typeof item !== 'string') return;
    const normalized = item.trim().toLowerCase();
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 8);
}

function resolveLlmLegalPolicySnapshot(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const sourcePolicy = payload.policy && typeof payload.policy === 'object' ? payload.policy : null;
  const normalized = typeof systemFlagsRepo.normalizeLlmPolicy === 'function'
    ? systemFlagsRepo.normalizeLlmPolicy(sourcePolicy)
    : fallbackNormalizePolicy(sourcePolicy);
  const policy = normalized === null
    ? resolveDefaultPolicy()
    : normalized;
  const legalReasonCodes = [];
  let legalDecision = 'allow';

  if (policy.lawfulBasis === 'consent' && policy.consentVerified !== true) {
    legalDecision = 'blocked';
    legalReasonCodes.push('consent_missing');
  } else if (policy.lawfulBasis === 'unspecified') {
    legalReasonCodes.push('lawful_basis_unspecified');
  }

  if (policy.crossBorder === true) {
    legalReasonCodes.push('cross_border_enabled');
  }

  return {
    policy,
    lawfulBasis: policy.lawfulBasis,
    consentVerified: policy.consentVerified === true,
    crossBorder: policy.crossBorder === true,
    legalDecision,
    legalReasonCodes: normalizeReasonCodes(legalReasonCodes),
    policySource: 'system_flags'
  };
}

async function loadLlmLegalPolicySnapshot(deps) {
  const payload = deps && typeof deps === 'object' ? deps : {};
  const repo = payload.systemFlagsRepo && typeof payload.systemFlagsRepo === 'object'
    ? payload.systemFlagsRepo
    : systemFlagsRepo;
  const getPolicy = typeof payload.getLlmPolicy === 'function'
    ? payload.getLlmPolicy
    : (typeof repo.getLlmPolicy === 'function' ? repo.getLlmPolicy.bind(repo) : null);
  if (!getPolicy) return resolveLlmLegalPolicySnapshot({ policy: null });
  try {
    const policy = await getPolicy();
    return resolveLlmLegalPolicySnapshot({ policy });
  } catch (_err) {
    return resolveLlmLegalPolicySnapshot({ policy: null });
  }
}

module.exports = {
  resolveLlmLegalPolicySnapshot,
  loadLlmLegalPolicySnapshot
};
