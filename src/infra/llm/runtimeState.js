'use strict';

const { isLlmFeatureEnabled } = require('../../llm/featureFlag');

const RUNTIME_BLOCKING_REASONS = new Set([
  'env_flag_disabled',
  'system_flag_disabled',
  'policy_block',
  'budget_block',
  'availability_block'
]);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function resolveRuntimeBlockingReasonFromBlockedReason(blockedReason, context) {
  const reason = normalizeText(blockedReason);
  const envFlag = context && context.envFlag === true;
  const systemFlag = context && context.systemFlag === true;
  if (!reason) return null;
  if (RUNTIME_BLOCKING_REASONS.has(reason)) return reason;
  if (reason === 'llm_disabled') {
    if (!envFlag) return 'env_flag_disabled';
    if (!systemFlag) return 'system_flag_disabled';
    return 'policy_block';
  }
  if (reason === 'policy_disabled' || reason === 'intent_not_allowed') return 'policy_block';
  if (reason === 'llm_unavailable') return 'availability_block';
  return 'budget_block';
}

function getLlmRuntimeState(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const envSource = payload.env && typeof payload.env === 'object' ? payload.env : process.env;
  const envFlag = typeof payload.envFlag === 'boolean'
    ? payload.envFlag
    : isLlmFeatureEnabled(envSource);
  const systemFlag = typeof payload.systemFlag === 'boolean'
    ? payload.systemFlag
    : Boolean(payload.llmEnabled);

  let blockingReason = null;
  if (!envFlag) {
    blockingReason = 'env_flag_disabled';
  } else if (!systemFlag) {
    blockingReason = 'system_flag_disabled';
  } else {
    blockingReason = resolveRuntimeBlockingReasonFromBlockedReason(payload.blockedReason, {
      envFlag,
      systemFlag
    });
  }

  return {
    envFlag,
    systemFlag,
    effectiveEnabled: envFlag === true && systemFlag === true && blockingReason === null,
    blockingReason
  };
}

module.exports = {
  getLlmRuntimeState,
  resolveRuntimeBlockingReasonFromBlockedReason
};
