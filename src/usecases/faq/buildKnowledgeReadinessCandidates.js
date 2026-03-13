'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeUpperText(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeRiskLevel(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'high' || normalized === 'medium') return normalized;
  return 'low';
}

function deriveAuthorityTier(item) {
  const recordEnvelope = item && item.recordEnvelope && typeof item.recordEnvelope === 'object'
    ? item.recordEnvelope
    : {};
  const tier = normalizeUpperText(recordEnvelope.authority_tier || item.authorityTier);
  if (tier) return tier;
  const riskLevel = normalizeRiskLevel(item && item.riskLevel);
  if (riskLevel === 'high') return 'T1_OFFICIAL_OPERATION';
  if (riskLevel === 'medium') return 'T2_PUBLIC_DATA';
  return 'T3_VENDOR';
}

function deriveBindingLevel(item) {
  const recordEnvelope = item && item.recordEnvelope && typeof item.recordEnvelope === 'object'
    ? item.recordEnvelope
    : {};
  const level = normalizeUpperText(recordEnvelope.binding_level || item.bindingLevel);
  if (level) return level;
  return normalizeRiskLevel(item && item.riskLevel) === 'high' ? 'POLICY' : 'REFERENCE';
}

function deriveSourceType(item, authorityTier) {
  const explicit = normalizeText(item && item.sourceType).toLowerCase();
  if (explicit) return explicit;
  if (authorityTier === 'T0_LAW_FORM' || authorityTier === 'T1_OFFICIAL_OPERATION') return 'official';
  if (authorityTier === 'T2_PUBLIC_DATA') return 'semi_official';
  if (authorityTier === 'T4_COMMUNITY') return 'community';
  if (Array.isArray(item && item.linkRegistryIds) && item.linkRegistryIds.length > 0) return 'semi_official';
  return 'other';
}

function buildKnowledgeReadinessCandidates(items) {
  const rows = Array.isArray(items) ? items : [];
  return rows
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const authorityTier = deriveAuthorityTier(item);
      const bindingLevel = deriveBindingLevel(item);
      return {
        sourceType: deriveSourceType(item, authorityTier),
        authorityLevel: normalizeText(item.authorityLevel).toLowerCase() || 'other',
        authorityTier,
        bindingLevel,
        validUntil: item.validUntil || null,
        status: normalizeText(item.status).toLowerCase() || 'active',
        requiredLevel: normalizeRiskLevel(item.riskLevel) === 'high' ? 'required' : 'optional',
        linkRegistryCount: Array.isArray(item.linkRegistryIds) ? item.linkRegistryIds.length : 0,
        sourceSnapshotRefCount: Array.isArray(item.sourceSnapshotRefs) ? item.sourceSnapshotRefs.length : 0
      };
    })
    .filter(Boolean);
}

module.exports = {
  buildKnowledgeReadinessCandidates
};
