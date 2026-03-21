'use strict';

const cityPacksRepo = require('../../../repos/firestore/cityPacksRepo');
const { searchCityPackCandidates } = require('../../../usecases/assistant/retrieval/searchCityPackCandidates');
const { validateCityPackSources } = require('../../../usecases/cityPack/validateCityPackSources');
const { computeSourceReadiness } = require('../knowledge/computeSourceReadiness');
const {
  extractLocationHintFromText,
  buildLocationHintFromRegionKey,
  normalizeCityKey
} = require('../../regionNormalization');

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

function normalizeLocationHint(hint) {
  const payload = hint && typeof hint === 'object' ? hint : {};
  return {
    kind: normalizeText(payload.kind) || 'none',
    matchedText: normalizeText(payload.matchedText) || null,
    regionKey: normalizeText(payload.regionKey).toLowerCase() || null,
    state: normalizeText(payload.state).toUpperCase() || null,
    city: normalizeText(payload.city) || null,
    cityKey: normalizeCityKey(payload.cityKey || payload.city),
    source: normalizeText(payload.source) || 'none'
  };
}

function resolveRequestedLocationHint(payload, fallbackRegionKey) {
  const contractHint = normalizeLocationHint(payload.requestContract && payload.requestContract.locationHint);
  if (contractHint.kind !== 'none') return contractHint;
  const textHint = normalizeLocationHint(extractLocationHintFromText(payload.messageText));
  if (textHint.kind !== 'none') return textHint;
  const profileHint = normalizeLocationHint(buildLocationHintFromRegionKey(fallbackRegionKey, 'profile_region'));
  return profileHint.kind !== 'none' ? profileHint : normalizeLocationHint(null);
}

function resolvePackLocationHint(pack) {
  const payload = pack && typeof pack === 'object' ? pack : {};
  if (payload.regionKey || (payload.metadata && payload.metadata.regionKey)) {
    return normalizeLocationHint(buildLocationHintFromRegionKey(payload.regionKey || payload.metadata.regionKey, 'pack_region_key'));
  }
  if (payload.regionCity || (payload.metadata && payload.metadata.regionCity)) {
    return normalizeLocationHint({
      kind: 'city',
      matchedText: payload.regionCity || payload.metadata.regionCity,
      regionKey: payload.regionState && payload.regionCity
        ? `${payload.regionState}::${normalizeCityKey(payload.regionCity)}`
        : null,
      state: payload.regionState || (payload.metadata && payload.metadata.regionState) || null,
      city: payload.regionCity || (payload.metadata && payload.metadata.regionCity) || null,
      cityKey: normalizeCityKey(payload.regionCity || (payload.metadata && payload.metadata.regionCity)),
      source: 'pack_metadata'
    });
  }
  return normalizeLocationHint(null);
}

function buildCitySpecificity(requestedLocationHint, matchedLocationHint) {
  const requested = normalizeLocationHint(requestedLocationHint);
  const matched = normalizeLocationHint(matchedLocationHint);
  const requestedCityKey = requested.cityKey || null;
  const matchedCityKey = matched.cityKey || null;
  if (!requestedCityKey) {
    return {
      requestedCityKey: null,
      matchedCityKey,
      citySpecificitySatisfied: false,
      citySpecificityReason: requested.kind === 'state' ? 'requested_state_only' : 'requested_city_missing'
    };
  }
  if (!matchedCityKey) {
    return {
      requestedCityKey,
      matchedCityKey: null,
      citySpecificitySatisfied: false,
      citySpecificityReason: 'candidate_city_missing'
    };
  }
  if (requestedCityKey !== matchedCityKey) {
    return {
      requestedCityKey,
      matchedCityKey,
      citySpecificitySatisfied: false,
      citySpecificityReason: 'city_mismatch'
    };
  }
  return {
    requestedCityKey,
    matchedCityKey,
    citySpecificitySatisfied: true,
    citySpecificityReason: 'city_exact_match'
  };
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
    payload.seededRegionKey = searchResult && searchResult.regionKey ? searchResult.regionKey : null;
  }
  const requestedLocationHint = resolveRequestedLocationHint(payload, payload.seededRegionKey);

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
      cityPackPackId: null,
      requestedCityKey: requestedLocationHint.cityKey || null,
      matchedCityKey: null,
      citySpecificitySatisfied: false,
      citySpecificityReason: requestedLocationHint.cityKey ? 'no_city_pack_candidate' : 'requested_city_missing',
      scopeDisclosureRequired: false
    };
  }

  const inspections = [];
  for (const candidate of cityPackCandidates.slice(0, 3)) {
    const cityPackId = normalizeText(candidate && candidate.sourceId);
    if (!cityPackId) continue;
    const pack = await getCityPack(cityPackId).catch(() => null);
    if (!pack || !Array.isArray(pack.sourceRefs) || !pack.sourceRefs.length) continue;
    const specificity = buildCitySpecificity(requestedLocationHint, resolvePackLocationHint(pack));
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
      specificity,
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
      cityPackPackId: null,
      requestedCityKey: requestedLocationHint.cityKey || null,
      matchedCityKey: null,
      citySpecificitySatisfied: false,
      citySpecificityReason: requestedLocationHint.cityKey ? 'candidate_present_without_valid_sources' : 'requested_city_missing',
      scopeDisclosureRequired: false
    };
  }

  const selected = inspections
    .slice()
    .sort((left, right) => {
      if (left.specificity.citySpecificitySatisfied !== right.specificity.citySpecificitySatisfied) {
        return left.specificity.citySpecificitySatisfied === true ? -1 : 1;
      }
      return scoreCityPackInspection(right) - scoreCityPackInspection(left);
    })[0];
  const specificitySatisfied = selected.specificity.citySpecificitySatisfied === true;
  const grounded = specificitySatisfied && selected.validation && selected.validation.blocked !== true;
  const groundingReason = selected.validation && selected.validation.blocked === true
    ? 'required_sources_blocked'
    : (specificitySatisfied ? 'validated_sources_available' : selected.specificity.citySpecificityReason);

  return {
    cityPackContext: true,
    cityPackGrounded: grounded,
    cityPackGroundingReason: groundingReason,
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
    cityPackPackId: selected.cityPackId,
    requestedCityKey: selected.specificity.requestedCityKey,
    matchedCityKey: selected.specificity.matchedCityKey,
    citySpecificitySatisfied: specificitySatisfied,
    citySpecificityReason: selected.specificity.citySpecificityReason,
    scopeDisclosureRequired: specificitySatisfied !== true && requestedLocationHint.kind === 'state'
  };
}

module.exports = {
  resolveRuntimeCityPackSignals
};
