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
  return {
    sourceType: ref.sourceType || 'other',
    authorityLevel: ref.authorityLevel || 'other',
    validUntil: ref.validUntil || null,
    status: ref.status || 'active',
    requiredLevel: ref.requiredLevel || 'required',
    domainClass: ref.domainClass || 'unknown',
    confidenceScore: ref.confidenceScore
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
      cityPackFreshnessScore: null,
      cityPackAuthorityScore: null,
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
      cityPackFreshnessScore: null,
      cityPackAuthorityScore: null,
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
    cityPackFreshnessScore: Number.isFinite(Number(selected.readiness.sourceFreshnessScore))
      ? Number(selected.readiness.sourceFreshnessScore)
      : null,
    cityPackAuthorityScore: Number.isFinite(Number(selected.readiness.sourceAuthorityScore))
      ? Number(selected.readiness.sourceAuthorityScore)
      : null,
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
