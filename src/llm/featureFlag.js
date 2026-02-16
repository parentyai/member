'use strict';

const ENV_KEY = 'LLM_FEATURE_FLAG';

function isLlmFeatureEnabled(env) {
  const source = env || process.env;
  const raw = source && Object.prototype.hasOwnProperty.call(source, ENV_KEY)
    ? source[ENV_KEY]
    : undefined;
  if (raw === undefined || raw === null || String(raw).trim().length === 0) return false;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

module.exports = {
  ENV_KEY,
  isLlmFeatureEnabled
};
