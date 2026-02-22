'use strict';

const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;

function resolveLimit(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(raw), MAX_LIMIT);
}

function normalizeRegionKey(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function normalizeLanguage(value) {
  const normalized = cityPacksRepo.normalizeLanguage(value);
  return typeof normalized === 'string' && normalized.trim() ? normalized.trim().toLowerCase() : 'ja';
}

function normalizePackClass(value) {
  return cityPacksRepo.normalizePackClass(value);
}

function normalizeTargetValue(value) {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase();
  return '';
}

function valueInRule(ruleValue, normalizedRegionKey) {
  if (!normalizedRegionKey) return false;
  if (Array.isArray(ruleValue)) {
    return ruleValue.some((item) => normalizeTargetValue(item) === normalizedRegionKey);
  }
  return normalizeTargetValue(ruleValue) === normalizedRegionKey;
}

function isRegionRule(rule) {
  if (!rule || typeof rule !== 'object') return false;
  const field = typeof rule.field === 'string' ? rule.field.trim().toLowerCase() : '';
  return field === 'regionkey' || field === 'region' || field === 'targetregionkey';
}

function matchesRegionalTarget(cityPack, normalizedRegionKey) {
  const targetingRules = Array.isArray(cityPack && cityPack.targetingRules) ? cityPack.targetingRules : [];
  const regionRules = targetingRules.filter(isRegionRule);
  if (!normalizedRegionKey) return true;
  if (!regionRules.length) return false;

  const includeRules = [];
  const excludeRules = [];
  regionRules.forEach((rule) => {
    const effect = typeof rule.effect === 'string' ? rule.effect.trim().toLowerCase() : 'include';
    if (effect === 'exclude') excludeRules.push(rule);
    else includeRules.push(rule);
  });

  const isExcluded = excludeRules.some((rule) => valueInRule(rule.value, normalizedRegionKey));
  if (isExcluded) return false;

  if (!includeRules.length) return true;
  return includeRules.some((rule) => valueInRule(rule.value, normalizedRegionKey));
}

function composeItem(cityPack, reason) {
  return {
    cityPackId: cityPack.id,
    name: cityPack.name || null,
    status: cityPack.status || null,
    packClass: normalizePackClass(cityPack.packClass),
    language: normalizeLanguage(cityPack.language),
    nationwidePolicy: cityPack.nationwidePolicy || null,
    validUntil: cityPack.validUntil || null,
    updatedAt: cityPack.updatedAt || null,
    reason
  };
}

async function composeCityAndNationwidePacks(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const regionKey = normalizeRegionKey(payload.regionKey);
  const language = normalizeLanguage(payload.language);
  const limit = resolveLimit(payload.limit);

  const listCityPacks = deps && deps.listCityPacks ? deps.listCityPacks : cityPacksRepo.listCityPacks;
  const fetchLimit = Math.min(limit * 4, 1000);
  const activeRows = await listCityPacks({
    status: 'active',
    language,
    limit: fetchLimit
  });

  const regionalItems = [];
  const nationwideItems = [];

  (activeRows || []).forEach((row) => {
    const packClass = normalizePackClass(row && row.packClass);
    if (packClass === 'nationwide') {
      const policy = row && row.nationwidePolicy ? String(row.nationwidePolicy).toLowerCase() : null;
      if (policy === cityPacksRepo.NATIONWIDE_POLICY_FEDERAL_ONLY) {
        nationwideItems.push(composeItem(row, 'nationwide_federal_match'));
      }
      return;
    }
    if (packClass !== 'regional') return;
    if (matchesRegionalTarget(row, regionKey)) {
      regionalItems.push(composeItem(row, regionKey ? 'regional_region_match' : 'regional_no_region_filter'));
    }
  });

  const merged = regionalItems.concat(nationwideItems).slice(0, limit);
  return {
    ok: true,
    regionKey,
    language,
    summary: {
      total: merged.length,
      regional: regionalItems.length,
      nationwide: nationwideItems.length
    },
    items: merged
  };
}

module.exports = {
  composeCityAndNationwidePacks,
  matchesRegionalTarget
};
