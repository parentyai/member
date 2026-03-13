'use strict';

const cityPacksRepo = require('../../../repos/firestore/cityPacksRepo');
const { searchCityPackCandidates } = require('../../../usecases/assistant/retrieval/searchCityPackCandidates');
const { validateCityPackSources } = require('../../../usecases/cityPack/validateCityPackSources');
const { computeSourceReadiness } = require('../knowledge/computeSourceReadiness');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function shouldInspectCityPack(domainIntent) {
  const normalized = normalizeText(domainIntent).toLowerCase();
  if (!normalized || normalized === 'general') return true;
  return normalized === 'school' || normalized === 'housing';
}

function toReadinessCandidate(item) {
  const ref = item && item.ref && typeof item.ref === 'object' ? item.ref : {};
  const sourceRefId = normalizeText(item && item.sourceRefId);
  const linkRegistryCount = Number.isFinite(Number(ref.linkRegistryCount))
    ? Math.max(0, Math.floor(Number(ref.linkRegistryCount)))
    : ((sourceRefId || item) ? 1 : 0);
  const sourceSnapshotRefCount = Number.isFinite(Number(ref.sourceSnapshotRefCount))
    ? Math.max(0, Math.floor(Number(ref.sourceSnapshotRefCount)))
    : 0;
  return {
    sourceType: ref.sourceType || 'other',
    authorityLevel: ref.authorityLevel || 'other',
    authorityTier: ref.authorityTier || ref.authorityTierHint || '',
    bindingLevel: ref.bindingLevel || ref.bindingLevelHint || '',
    validUntil: ref.validUntil || null,
    status: ref.status || 'active',
    requiredLevel: ref.requiredLevel || 'required',
    domainClass: ref.domainClass || 'unknown',
    confidenceScore: ref.confidenceScore,
    linkRegistryCount,
    sourceSnapshotRefCount
  };
}

function scoreCityPackInspection(item) {
  const payload = item && typeof item === 'object' ? item : {};
  const readiness = payload.readiness && typeof payload.readiness === 'object' ? payload.readiness : {};
  const validation = payload.validation && typeof payload.validation === 'object' ? payload.validation : {};
  let score = 0;
  if (validation.blocked === true) score -= 3;
  if (readiness.officialOnlySatisfied === true) score += 2;
  if (readiness.sourceReadinessDecision === 'allow') score += 2;
  if (readiness.sourceReadinessDecision === 'hedged') score += 1;
  score += Number(readiness.sourceAuthorityScore) || 0;
  score += Number(readiness.sourceFreshnessScore) || 0;
  score -= Array.isArray(validation.optionalInvalidSourceRefs) ? validation.optionalInvalidSourceRefs.length * 0.1 : 0;
  return score;
}

async function resolveRuntimeCityPackSignals(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const locale = normalizeText(payload.locale || 'ja') || 'ja';
  const intentRiskTier = normalizeText(payload.intentRiskTier).toLowerCase() || 'low';
  const domainIntent = normalizeText(payload.domainIntent).toLowerCase() || 'general';
  const candidateSearch = resolvedDeps.searchCityPackCandidates || searchCityPackCandidates;
  const getCityPack = resolvedDeps.getCityPack || cityPacksRepo.getCityPack;
  const validateSources = resolvedDeps.validateCityPackSources || validateCityPackSources;

  const explicitCandidates = Array.isArray(payload.cityPackCandidates) ? payload.cityPackCandidates : [];
  let cityPackCandidates = explicitCandidates;
  if (!cityPackCandidates.length && lineUserId && shouldInspectCityPack(domainIntent)) {
    const searchResult = await candidateSearch({
      lineUserId,
      locale,
      limit: 3
    }).catch(() => ({ ok: false, candidates: [] }));
    cityPackCandidates = Array.isArray(searchResult && searchResult.candidates) ? searchResult.candidates : [];
  }

  if (!cityPackCandidates.length) {
    return {
      cityPackContext: false,
      cityPackGrounded: false,
      cityPackGroundingReason: null,
      cityPackFreshnessScore: null,
      cityPackAuthorityScore: null,
      cityPackRequiredSourcesSatisfied: null,
      cityPackSourceSnapshot: null,
      cityPackValidation: null,
      cityPackSourceReadinessDecision: null,
      cityPackSourceReadinessReasons: [],
      cityPackPackId: null
    };
  }

  const inspections = [];
  for (const candidate of cityPackCandidates.slice(0, 3)) {
    const cityPackId = normalizeText(candidate && candidate.sourceId);
    if (!cityPackId) continue;
    const pack = await getCityPack(cityPackId).catch(() => null);
    if (!pack || !Array.isArray(pack.sourceRefs) || !pack.sourceRefs.length) continue;
    const validation = await validateSources({
      sourceRefIds: pack.sourceRefs,
      packClass: pack.packClass || candidate.packClass || null
    }).catch(() => null);
    if (!validation || !Array.isArray(validation.sourceRefs)) continue;
    const readiness = computeSourceReadiness({
      intentRiskTier,
      candidates: validation.sourceRefs.map((item) => toReadinessCandidate(item)),
      retrievalQuality: 'good',
      retrieveNeeded: true,
      evidenceCoverage: validation.sourceRefs.length ? 1 : 0
    });
    inspections.push({
      cityPackId,
      validation,
      readiness
    });
  }

  if (!inspections.length) {
    return {
      cityPackContext: true,
      cityPackGrounded: false,
      cityPackGroundingReason: 'candidate_present_without_valid_sources',
      cityPackFreshnessScore: null,
      cityPackAuthorityScore: null,
      cityPackRequiredSourcesSatisfied: null,
      cityPackSourceSnapshot: null,
      cityPackValidation: null,
      cityPackSourceReadinessDecision: null,
      cityPackSourceReadinessReasons: [],
      cityPackPackId: null
    };
  }

  const selected = inspections
    .slice()
    .sort((left, right) => scoreCityPackInspection(right) - scoreCityPackInspection(left))[0];

  return {
    cityPackContext: true,
    cityPackGrounded: selected.validation && selected.validation.blocked !== true,
    cityPackGroundingReason: selected.validation && selected.validation.blocked === true
      ? 'required_sources_blocked'
      : 'validated_sources_available',
    cityPackFreshnessScore: Number.isFinite(Number(selected.readiness.sourceFreshnessScore))
      ? Number(selected.readiness.sourceFreshnessScore)
      : null,
    cityPackAuthorityScore: Number.isFinite(Number(selected.readiness.sourceAuthorityScore))
      ? Number(selected.readiness.sourceAuthorityScore)
      : null,
    cityPackRequiredSourcesSatisfied: selected.validation
      ? !(Array.isArray(selected.validation.blockingInvalidSourceRefs) && selected.validation.blockingInvalidSourceRefs.length > 0)
      : null,
    cityPackSourceSnapshot: {
      packId: selected.cityPackId,
      sourceRefIds: Array.isArray(selected.validation && selected.validation.sourceRefs)
        ? selected.validation.sourceRefs
          .map((item) => normalizeText(item && (item.sourceRefId || item.id || item.refId)))
          .filter(Boolean)
          .slice(0, 8)
        : [],
      blockingInvalidSourceRefs: Array.isArray(selected.validation && selected.validation.blockingInvalidSourceRefs)
        ? selected.validation.blockingInvalidSourceRefs.slice(0, 8)
        : [],
      optionalInvalidSourceRefs: Array.isArray(selected.validation && selected.validation.optionalInvalidSourceRefs)
        ? selected.validation.optionalInvalidSourceRefs.slice(0, 8)
        : [],
      sourceReadinessDecision: selected.readiness.sourceReadinessDecision || null
    },
    cityPackValidation: selected.validation,
    cityPackSourceReadinessDecision: selected.readiness.sourceReadinessDecision || null,
    cityPackSourceReadinessReasons: Array.isArray(selected.readiness.reasonCodes)
      ? selected.readiness.reasonCodes.slice(0, 8)
      : [],
    cityPackPackId: selected.cityPackId
  };
}

module.exports = {
  resolveRuntimeCityPackSignals
};
