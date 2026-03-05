'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { isLinkRegistryIntentV2Enabled } = require('../../domain/tasks/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function matchesTag(link, field, expected) {
  const desired = normalizeText(expected);
  if (!desired) return true;
  const actual = normalizeText(link && link[field]);
  return actual === desired;
}

function matchesIntent(link, filters) {
  const payload = filters && typeof filters === 'object' ? filters : {};
  return matchesTag(link, 'intentTag', payload.intentTag)
    && matchesTag(link, 'audienceTag', payload.audienceTag)
    && matchesTag(link, 'regionScope', payload.regionScope)
    && matchesTag(link, 'riskLevel', payload.riskLevel);
}

async function resolveLinkIntent(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const linkRepo = resolvedDeps.linkRegistryRepo || linkRegistryRepo;
  const linkId = typeof payload.linkId === 'string' ? payload.linkId.trim() : '';
  const filters = {
    intentTag: payload.intentTag || null,
    audienceTag: payload.audienceTag || null,
    regionScope: payload.regionScope || null,
    riskLevel: payload.riskLevel || null
  };

  if (linkId) {
    const link = await linkRepo.getLink(linkId);
    if (!link) return { ok: false, link: null, reason: 'not_found' };
    if (!isLinkRegistryIntentV2Enabled()) return { ok: true, link, reason: null };
    if (!matchesIntent(link, filters)) return { ok: false, link, reason: 'intent_mismatch' };
    return { ok: true, link, reason: null };
  }

  const listFilters = Object.assign(
    { limit: Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.floor(Number(payload.limit))) : 50 },
    isLinkRegistryIntentV2Enabled() ? filters : {}
  );
  const items = await linkRepo.listLinks(listFilters);
  const filtered = isLinkRegistryIntentV2Enabled()
    ? items.filter((item) => matchesIntent(item, filters))
    : items;
  return { ok: true, items: filtered };
}

module.exports = {
  resolveLinkIntent,
  matchesIntent
};
