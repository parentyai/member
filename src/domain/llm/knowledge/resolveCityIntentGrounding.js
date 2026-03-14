'use strict';

const cityPacksRepo = require('../../../repos/firestore/cityPacksRepo');
const { searchCityPackCandidates } = require('../../../usecases/assistant/retrieval/searchCityPackCandidates');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeRegionKey(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || null;
}

function buildLookupTokens(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return [];
  return normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function matchesCityPackByMessage(messageText, row) {
  const haystack = normalizeText(messageText).toLowerCase();
  if (!haystack) return false;
  const candidates = []
    .concat(buildLookupTokens(row && row.name))
    .concat(buildLookupTokens(row && row.regionKey))
    .concat(buildLookupTokens(row && row.regionCity))
    .concat(buildLookupTokens(row && row.regionState));
  return candidates.some((token) => token && haystack.includes(token));
}

function toCandidate(row, reason) {
  const payload = row && typeof row === 'object' ? row : {};
  const cityPackId = normalizeText(payload.cityPackId || payload.id);
  if (!cityPackId) return null;
  return {
    sourceType: 'city_pack',
    sourceId: cityPackId,
    title: normalizeText(payload.name) || cityPackId,
    reason: normalizeText(reason || payload.reason) || 'city_pack_match',
    regionKey: normalizeRegionKey(payload.regionKey),
    packClass: normalizeText(payload.packClass) || null,
    allowedIntents: Array.isArray(payload.allowedIntents) ? payload.allowedIntents.slice(0, 8) : [],
    sourceRefs: Array.isArray(payload.sourceRefs) ? payload.sourceRefs.slice(0, 8) : [],
    validUntil: payload.validUntil || null,
    updatedAt: payload.updatedAt || null
  };
}

async function resolveCityIntentGrounding(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const locale = normalizeText(payload.locale) || 'ja';
  const lineUserId = normalizeText(payload.lineUserId);
  const genericFallbackSlice = normalizeText(payload.genericFallbackSlice).toLowerCase();
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const searchCandidates = typeof resolvedDeps.searchCityPackCandidates === 'function'
    ? resolvedDeps.searchCityPackCandidates
    : searchCityPackCandidates;
  const listCityPacks = typeof resolvedDeps.listCityPacks === 'function'
    ? resolvedDeps.listCityPacks
    : cityPacksRepo.listCityPacks;

  const seeded = await searchCandidates({
    lineUserId,
    locale,
    limit: 3
  }).catch(() => ({ ok: true, mode: 'empty', candidates: [], regionKey: null }));

  const seededCandidates = Array.isArray(seeded && seeded.candidates)
    ? seeded.candidates.map((row) => toCandidate(row, row && row.reason)).filter(Boolean)
    : [];

  if (seededCandidates.length > 0) {
    return {
      ok: true,
      mode: 'seeded',
      regionKey: normalizeRegionKey(seeded && seeded.regionKey),
      candidates: seededCandidates
    };
  }

  if (genericFallbackSlice !== 'city') {
    return {
      ok: true,
      mode: 'empty',
      regionKey: normalizeRegionKey(seeded && seeded.regionKey),
      candidates: []
    };
  }

  const activeRows = await listCityPacks({
    status: 'active',
    activeOnly: true,
    language: locale,
    limit: 50
  }).catch(() => []);

  const matched = (Array.isArray(activeRows) ? activeRows : [])
    .filter((row) => matchesCityPackByMessage(messageText, row))
    .slice(0, 3)
    .map((row) => toCandidate(row, 'city_pack_text_match'))
    .filter(Boolean);

  return {
    ok: true,
    mode: matched.length > 0 ? 'text_match' : 'empty',
    regionKey: normalizeRegionKey(seeded && seeded.regionKey),
    candidates: matched
  };
}

module.exports = {
  resolveCityIntentGrounding
};
