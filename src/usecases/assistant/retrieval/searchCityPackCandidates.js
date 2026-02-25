'use strict';

const usersRepo = require('../../../repos/firestore/usersRepo');
const { composeCityAndNationwidePacks } = require('../../nationwidePack/composeCityAndNationwidePacks');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveRegionKey(user) {
  if (!user || typeof user !== 'object') return null;
  const explicit = normalizeText(user.regionKey || user.targetRegionKey);
  if (explicit) return explicit.toLowerCase();
  const state = normalizeText(user.region || user.state || user.regionState);
  const city = normalizeText(user.city || user.regionCity || user.targetCity);
  if (state && city) return `${state}::${city}`.toLowerCase();
  if (state) return state.toLowerCase();
  return null;
}

function toCandidate(item) {
  const payload = item && typeof item === 'object' ? item : {};
  const cityPackId = normalizeText(payload.cityPackId);
  if (!cityPackId) return null;
  return {
    sourceType: 'city_pack',
    sourceId: cityPackId,
    title: normalizeText(payload.name) || cityPackId,
    reason: normalizeText(payload.reason) || 'city_pack_match',
    packClass: normalizeText(payload.packClass) || null,
    validUntil: payload.validUntil || null,
    updatedAt: payload.updatedAt || null
  };
}

async function searchCityPackCandidates(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId);
  if (!lineUserId) {
    return {
      ok: true,
      mode: 'empty',
      candidates: [],
      regionKey: null
    };
  }

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const userRepo = resolvedDeps.usersRepo || usersRepo;
  const compose = resolvedDeps.composeCityAndNationwidePacks || composeCityAndNationwidePacks;

  const user = await userRepo.getUser(lineUserId).catch(() => null);
  const regionKey = resolveRegionKey(user);
  const language = normalizeText(payload.locale || payload.language || 'ja') || 'ja';
  const limit = Number.isInteger(payload.limit) && payload.limit > 0 ? Math.min(payload.limit, 5) : 3;

  try {
    const merged = await compose({
      regionKey,
      language,
      limit
    });
    const rows = Array.isArray(merged && merged.items) ? merged.items : [];
    const candidates = rows.map((row) => toCandidate(row)).filter(Boolean).slice(0, limit);
    return {
      ok: true,
      mode: candidates.length ? 'ranked' : 'empty',
      regionKey,
      candidates
    };
  } catch (_err) {
    return {
      ok: true,
      mode: 'empty',
      regionKey,
      candidates: []
    };
  }
}

module.exports = {
  searchCityPackCandidates
};
