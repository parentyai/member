'use strict';

const { ALLOWED_MODULES } = require('../../repos/firestore/cityPacksRepo');

const ALLOWED_MODULE_SET = new Set(ALLOWED_MODULES);

function normalizeModules(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((value) => {
    if (typeof value !== 'string') return;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    if (!ALLOWED_MODULE_SET.has(normalized)) return;
    if (out.includes(normalized)) return;
    out.push(normalized);
  });
  return Array.from(new Set(out));
}

function isCityPackModuleSubscribed(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const modulesUpdated = normalizeModules(payload.modulesUpdated);
  const modulesSubscribed = normalizeModules(payload.modulesSubscribed);
  if (!modulesUpdated.length) return true;
  // Legacy compatibility: no preference means all subscribed.
  if (!modulesSubscribed.length) return true;
  return modulesUpdated.some((module) => modulesSubscribed.includes(module));
}

module.exports = {
  ALLOWED_MODULES,
  normalizeModules,
  isCityPackModuleSubscribed
};
