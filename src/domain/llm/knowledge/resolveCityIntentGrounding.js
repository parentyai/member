'use strict';

const cityPacksRepo = require('../../../repos/firestore/cityPacksRepo');
const { searchCityPackCandidates } = require('../../../usecases/assistant/retrieval/searchCityPackCandidates');
const {
  extractLocationHintFromText,
  buildLocationHintFromRegionKey,
  normalizeCityKey
} = require('../../regionNormalization');

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

function normalizeLocationHint(hint) {
  const payload = hint && typeof hint === 'object' ? hint : {};
  return {
    kind: normalizeText(payload.kind) || 'none',
    matchedText: normalizeText(payload.matchedText) || null,
    regionKey: normalizeRegionKey(payload.regionKey),
    state: normalizeText(payload.state).toUpperCase() || null,
    city: normalizeText(payload.city) || null,
    cityKey: normalizeCityKey(payload.cityKey || payload.city),
    source: normalizeText(payload.source) || 'none'
  };
}

function resolveRequestedLocationHint(messageText, requestContract, fallbackRegionKey) {
  const contractHint = normalizeLocationHint(requestContract && requestContract.locationHint);
  if (contractHint.kind !== 'none') return contractHint;
  const textHint = normalizeLocationHint(extractLocationHintFromText(messageText));
  if (textHint.kind !== 'none') return textHint;
  const profileHint = normalizeLocationHint(buildLocationHintFromRegionKey(fallbackRegionKey, 'profile_region'));
  return profileHint.kind !== 'none' ? profileHint : normalizeLocationHint(null);
}

function resolveCandidateLocationHint(candidate) {
  const payload = candidate && typeof candidate === 'object' ? candidate : {};
  if (payload.regionKey) {
    const fromRegionKey = normalizeLocationHint(buildLocationHintFromRegionKey(payload.regionKey, 'candidate_region_key'));
    if (fromRegionKey.kind !== 'none') return fromRegionKey;
  }
  if (payload.regionCity || payload.regionState) {
    return normalizeLocationHint({
      kind: payload.regionCity ? 'city' : 'state',
      matchedText: payload.regionCity || payload.regionState,
      regionKey: payload.regionState && payload.regionCity ? `${payload.regionState}::${normalizeCityKey(payload.regionCity)}` : payload.regionState,
      state: payload.regionState || null,
      city: payload.regionCity || null,
      cityKey: normalizeCityKey(payload.regionCity),
      source: 'candidate_metadata'
    });
  }
  return normalizeLocationHint(null);
}

function buildCitySpecificity(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const requested = normalizeLocationHint(payload.requestedLocationHint);
  const matched = normalizeLocationHint(payload.matchedLocationHint);
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
    regionCity: normalizeText(payload.regionCity) || null,
    regionState: normalizeText(payload.regionState) || null,
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
  const requestedLocationHint = resolveRequestedLocationHint(
    messageText,
    payload.requestContract && typeof payload.requestContract === 'object' ? payload.requestContract : null,
    seeded && seeded.regionKey
  );

  const seededCandidates = Array.isArray(seeded && seeded.candidates)
    ? seeded.candidates.map((row) => toCandidate(row, row && row.reason)).filter(Boolean)
    : [];
  const seededMatched = seededCandidates
    .map((candidate) => ({
      candidate,
      specificity: buildCitySpecificity({
        requestedLocationHint,
        matchedLocationHint: resolveCandidateLocationHint(candidate)
      })
    }))
    .filter((row) => row.specificity.citySpecificitySatisfied === true);

  if (seededMatched.length > 0) {
    return {
      ok: true,
      mode: 'seeded',
      regionKey: normalizeRegionKey(seeded && seeded.regionKey),
      requestedCityKey: seededMatched[0].specificity.requestedCityKey,
      matchedCityKey: seededMatched[0].specificity.matchedCityKey,
      citySpecificitySatisfied: true,
      citySpecificityReason: seededMatched[0].specificity.citySpecificityReason,
      candidates: seededMatched.map((row) => row.candidate)
    };
  }

  if (genericFallbackSlice !== 'city') {
    return {
      ok: true,
      mode: 'empty',
      regionKey: normalizeRegionKey(seeded && seeded.regionKey),
      requestedCityKey: requestedLocationHint.cityKey || null,
      matchedCityKey: null,
      citySpecificitySatisfied: false,
      citySpecificityReason: requestedLocationHint.cityKey ? 'no_exact_city_pack_match' : 'requested_city_missing',
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
    .slice(0, 6)
    .map((row) => toCandidate(row, 'city_pack_text_match'))
    .map((candidate) => ({
      candidate,
      specificity: buildCitySpecificity({
        requestedLocationHint,
        matchedLocationHint: resolveCandidateLocationHint(candidate)
      })
    }))
    .filter((row) => row.specificity.citySpecificitySatisfied === true)
    .slice(0, 3)
    .map((row) => row.candidate)
    .filter(Boolean);

  return {
    ok: true,
    mode: matched.length > 0 ? 'text_match' : 'empty',
    regionKey: normalizeRegionKey(seeded && seeded.regionKey),
    requestedCityKey: requestedLocationHint.cityKey || null,
    matchedCityKey: matched.length > 0 ? resolveCandidateLocationHint(matched[0]).cityKey : null,
    citySpecificitySatisfied: matched.length > 0,
    citySpecificityReason: matched.length > 0 ? 'city_exact_match' : (requestedLocationHint.cityKey ? 'no_exact_city_pack_match' : 'requested_city_missing'),
    candidates: matched
  };
}

module.exports = {
  resolveCityIntentGrounding
};
