'use strict';

const FALLBACK_MODE_ALLOW = 'allow';
const FALLBACK_MODE_BLOCK = 'block';

function normalizeFallbackMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === FALLBACK_MODE_ALLOW) return FALLBACK_MODE_ALLOW;
  if (normalized === FALLBACK_MODE_BLOCK) return FALLBACK_MODE_BLOCK;
  return null;
}

function resolveFallbackModeDefault() {
  const envMode = normalizeFallbackMode(process.env.READ_PATH_FALLBACK_MODE_DEFAULT);
  return envMode || FALLBACK_MODE_BLOCK;
}

function resolveFallbackMode(value) {
  return normalizeFallbackMode(value) || resolveFallbackModeDefault();
}

module.exports = {
  FALLBACK_MODE_ALLOW,
  FALLBACK_MODE_BLOCK,
  normalizeFallbackMode,
  resolveFallbackModeDefault,
  resolveFallbackMode
};
