'use strict';

function shouldFailOnMissingIndex() {
  const value = process.env.FIRESTORE_FAIL_ON_MISSING_INDEX;
  return value === '1' || value === 'true';
}

function recordMissingIndexFallback(context) {
  const payload = context && typeof context === 'object' ? context : {};
  const repo = typeof payload.repo === 'string' ? payload.repo : 'unknown_repo';
  const query = typeof payload.query === 'string' ? payload.query : 'unknown_query';
  const err = payload.err && payload.err.message ? String(payload.err.message) : '';
  console.warn(`[WARN] firestore_missing_index_fallback repo=${repo} query=${query} failMode=${shouldFailOnMissingIndex()} err=${err}`);
}

module.exports = {
  shouldFailOnMissingIndex,
  recordMissingIndexFallback
};
