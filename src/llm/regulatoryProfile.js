'use strict';

const POLICY_SNAPSHOT_VERSION = 'llm_policy_v1';

function normalizeFieldCategoriesUsed(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function buildRegulatoryProfile(params) {
  const payload = params || {};
  const policy = payload.policy || {};
  return {
    policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
    lawfulBasis: policy.lawfulBasis || 'unspecified',
    consentVerified: policy.consentVerified === true,
    crossBorder: policy.crossBorder === true,
    fieldCategoriesUsed: normalizeFieldCategoriesUsed(payload.fieldCategoriesUsed),
    blockedReasonCategory: payload.blockedReasonCategory || null
  };
}

module.exports = {
  POLICY_SNAPSHOT_VERSION,
  buildRegulatoryProfile
};
