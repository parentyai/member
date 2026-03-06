'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { getLlmRuntimeState } = require('../../src/infra/llm/runtimeState');
const { evaluateLLMBudget, __testOnly } = require('../../src/usecases/billing/evaluateLlmBudget');

function withEnv(patch) {
  const prev = {};
  Object.keys(patch).forEach((key) => {
    prev[key] = process.env[key];
    if (patch[key] === null || patch[key] === undefined) delete process.env[key];
    else process.env[key] = String(patch[key]);
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  };
}

function createBudgetDeps(options) {
  const payload = options && typeof options === 'object' ? options : {};
  return {
    systemFlagsRepo: {
      getLlmEnabled: async () => payload.llmEnabled !== false
    },
    llmUsageStatsRepo: {
      getUserUsageStats: async () => null
    },
    opsConfigRepo: {
      getLlmPolicy: async () => ({
        enabled: true,
        model: 'gpt-4o-mini',
        per_user_daily_limit: 20,
        per_user_token_budget: 12000,
        global_qps_limit: 5,
        allowed_intents_free: ['faq_search'],
        allowed_intents_pro: ['faq_search', 'situation_analysis']
      })
    }
  };
}

test('phase718: runtime state maps env/system flags and blocking reasons', async () => {
  const disabledEnv = getLlmRuntimeState({ envFlag: false, systemFlag: true, blockedReason: 'llm_disabled' });
  assert.equal(disabledEnv.envFlag, false);
  assert.equal(disabledEnv.systemFlag, true);
  assert.equal(disabledEnv.effectiveEnabled, false);
  assert.equal(disabledEnv.blockingReason, 'env_flag_disabled');

  const disabledSystem = getLlmRuntimeState({ envFlag: true, systemFlag: false, blockedReason: 'llm_disabled' });
  assert.equal(disabledSystem.blockingReason, 'system_flag_disabled');

  const budgetBlocked = getLlmRuntimeState({ envFlag: true, systemFlag: true, blockedReason: 'token_budget_exceeded' });
  assert.equal(budgetBlocked.blockingReason, 'budget_block');
  assert.equal(budgetBlocked.effectiveEnabled, false);

  const runtimeOk = getLlmRuntimeState({ envFlag: true, systemFlag: true, blockedReason: null });
  assert.equal(runtimeOk.effectiveEnabled, true);
  assert.equal(runtimeOk.blockingReason, null);
});

test('phase718: evaluateLLMBudget returns runtimeState for allowed and blocked decisions', async () => {
  __testOnly.globalRequestTimestamps.length = 0;
  const policy = {
    enabled: true,
    model: 'gpt-4o-mini',
    per_user_daily_limit: 20,
    per_user_token_budget: 12000,
    global_qps_limit: 5,
    allowed_intents_free: ['faq_search'],
    allowed_intents_pro: ['faq_search', 'situation_analysis']
  };

  const restoreEnvDisabled = withEnv({ LLM_FEATURE_FLAG: null });
  try {
    const blocked = await evaluateLLMBudget('U_PHASE718_ENV_OFF', {
      intent: 'situation_analysis',
      tokenEstimate: 0,
      planInfo: { plan: 'pro', status: 'active' },
      policy
    }, createBudgetDeps({ llmEnabled: true }));
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.blockedReason, 'llm_disabled');
    assert.equal(blocked.runtimeState.envFlag, false);
    assert.equal(blocked.runtimeState.systemFlag, true);
    assert.equal(blocked.runtimeState.blockingReason, 'env_flag_disabled');
  } finally {
    restoreEnvDisabled();
  }

  const restoreEnvEnabled = withEnv({ LLM_FEATURE_FLAG: 'true' });
  try {
    const allowed = await evaluateLLMBudget('U_PHASE718_OK', {
      intent: 'situation_analysis',
      tokenEstimate: 0,
      planInfo: { plan: 'pro', status: 'active' },
      policy
    }, createBudgetDeps({ llmEnabled: true }));
    assert.equal(allowed.allowed, true);
    assert.equal(allowed.runtimeState.envFlag, true);
    assert.equal(allowed.runtimeState.systemFlag, true);
    assert.equal(allowed.runtimeState.effectiveEnabled, true);
    assert.equal(allowed.runtimeState.blockingReason, null);
  } finally {
    restoreEnvEnabled();
    __testOnly.globalRequestTimestamps.length = 0;
  }
});
