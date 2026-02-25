'use strict';

const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');

function resolveForcedOutage(env) {
  const raw = env && env.LLM_OUTAGE_MODE;
  if (typeof raw !== 'string') return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on';
}

async function evaluateLlmAvailability(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const policy = payload.policy && typeof payload.policy === 'object' ? payload.policy : null;
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const flagsRepo = resolvedDeps.systemFlagsRepo || systemFlagsRepo;

  if (!policy || policy.enabled !== true) {
    return { available: false, reason: 'policy_disabled' };
  }

  if (resolveForcedOutage(payload.env || process.env)) {
    return { available: false, reason: 'llm_outage_mode' };
  }

  if (!isLlmFeatureEnabled(payload.env || process.env)) {
    return { available: false, reason: 'llm_feature_flag_off' };
  }

  const systemEnabled = await flagsRepo.getLlmEnabled().catch(() => false);
  if (!systemEnabled) {
    return { available: false, reason: 'llm_system_flag_off' };
  }

  return { available: true, reason: null };
}

module.exports = {
  evaluateLlmAvailability
};
