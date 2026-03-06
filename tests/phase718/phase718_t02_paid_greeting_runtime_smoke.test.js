'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const HMAC_SEED = ['phase718', 'paid', 'runtime', 'smoke'].join('_');

function signBody(body) {
  return crypto.createHmac('sha256', HMAC_SEED).update(body).digest('base64');
}

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

function createWebhookBody(text) {
  return JSON.stringify({
    events: [
        {
          type: 'message',
          replyToken: 'rt_test',
          source: { userId: 'U_PHASE718_PAID' },
          message: { type: 'text', text }
        }
    ]
  });
}

function loadWebhookWithStubs(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const auditCalls = [];
  let retrievalCalled = 0;
  let paidFaqCalled = 0;
  let paidAssistantCalled = 0;
  let composeCalled = 0;

  const overrides = new Map();
  function setOverride(modulePath, exportsValue) {
    const resolved = require.resolve(modulePath);
    overrides.set(resolved, {
      previous: require.cache[resolved],
      replacement: {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: exportsValue
      }
    });
  }

  setOverride('../../src/usecases/users/ensureUser', {
    ensureUserFromWebhook: async () => ({ ok: true })
  });
  setOverride('../../src/usecases/notifications/sendWelcomeMessage', {
    sendWelcomeMessage: async () => ({ skipped: true })
  });
  setOverride('../../src/usecases/line/logLineWebhookEvents', {
    logLineWebhookEventsBestEffort: async () => ({ ok: true })
  });
  setOverride('../../src/usecases/users/declareRedacMembershipIdFromLine', {
    declareRedacMembershipIdFromLine: async () => ({ status: 'none' })
  });
  setOverride('../../src/usecases/users/getRedacMembershipStatusForLine', {
    getRedacMembershipStatusForLine: async () => ({ status: 'NOT_DECLARED' })
  });
  setOverride('../../src/infra/lineClient', {
    replyMessage: async () => ({ status: 200 }),
    pushMessage: async () => ({ status: 200 })
  });
  setOverride('../../src/usecases/cityPack/declareCityRegionFromLine', {
    declareCityRegionFromLine: async () => ({ status: 'none' })
  });
  setOverride('../../src/usecases/cityPack/declareCityPackFeedbackFromLine', {
    declareCityPackFeedbackFromLine: async () => ({ status: 'none' })
  });
  setOverride('../../src/usecases/cityPack/syncCityPackRecommendedTasks', {
    syncCityPackRecommendedTasks: async () => ({ ok: true })
  });
  setOverride('../../src/usecases/llm/recordUserLlmConsent', {
    recordUserLlmConsent: async () => ({ ok: true })
  });
  setOverride('../../src/repos/firestore/eventsRepo', {
    createEvent: async () => ({ ok: true })
  });
  setOverride('../../src/usecases/audit/appendAuditLog', {
    appendAuditLog: async (entry) => {
      auditCalls.push(entry);
      return { id: 'audit_phase718' };
    }
  });
  setOverride('../../src/repos/firestore/systemFlagsRepo', {
    getPublicWriteSafetySnapshot: async () => ({
      killSwitchOn: false,
      failCloseMode: 'warn',
      trackAuditWriteMode: 'best_effort',
      readError: false,
      source: 'test'
    }),
    getLlmEnabled: async () => true,
    getLlmConciergeEnabled: async () => payload.llmConciergeEnabled !== false,
    getLlmWebSearchEnabled: async () => true,
    getLlmStyleEngineEnabled: async () => true,
    getLlmBanditEnabled: async () => false
  });
  setOverride('../../src/usecases/billing/planGate', {
    resolvePlan: async () => ({
      plan: 'pro',
      status: 'active'
    }),
    normalizeIntentName: (value) => String(value || '').trim().toLowerCase(),
    resolveAllowedIntent: async (_plan, params) => {
      const policy = params && params.policy && typeof params.policy === 'object' ? params.policy : {};
      const intents = Array.isArray(policy.allowed_intents_pro) ? policy.allowed_intents_pro : ['faq_search'];
      return {
        plan: 'pro',
        allowedIntents: intents.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean),
        policy
      };
    }
  });
  setOverride('../../src/repos/firestore/opsConfigRepo', {
    getLlmPolicy: async () => ({
      enabled: true,
      model: 'gpt-4o-mini',
      temperature: 0.2,
      top_p: 1,
      max_output_tokens: 600,
      per_user_daily_limit: 20,
      per_user_token_budget: 12000,
      global_qps_limit: 5,
      cache_ttl_sec: 120,
      allowed_intents_free: ['faq_search'],
      allowed_intents_pro: ['situation_analysis', 'faq_search'],
      safety_mode: 'strict',
      forbidden_domains: [],
      refusal_strategy: {
        mode: 'suggest_and_consult',
        show_blocked_reason: false,
        fallback: 'free_retrieval'
      }
    }),
    normalizeIntentToken: (value) => String(value || '').trim().toLowerCase()
  });
  setOverride('../../src/repos/firestore/llmUsageStatsRepo', {
    getUserUsageStats: async () => null
  });
  setOverride('../../src/usecases/assistant/recordLlmUsage', {
    recordLlmUsage: async () => ({ costEstimate: 0 })
  });
  setOverride('../../src/usecases/assistant/llmAvailabilityGate', {
    evaluateLlmAvailability: async () => ({ available: true })
  });
  setOverride('../../src/usecases/context/getUserContextSnapshot', {
    getUserContextSnapshot: async () => ({
      ok: true,
      stale: false,
      snapshot: {
        phase: 'arrival',
        topOpenTasks: [],
        riskFlags: []
      }
    })
  });
  setOverride('../../src/usecases/assistant/generateFreeRetrievalReply', {
    generateFreeRetrievalReply: async () => {
      retrievalCalled += 1;
      return {
        ok: true,
        mode: 'ranked',
        replyText: 'こんにちは の関連情報です。\n\nFAQ候補',
        citations: [],
        faqCandidates: [],
        cityPackCandidates: [],
        blockedReasons: [],
        injectionFindings: false
      };
    }
  });
  setOverride('../../src/usecases/assistant/generatePaidFaqReply', {
    generatePaidFaqReply: async () => {
      paidFaqCalled += 1;
      return { ok: false, blockedReason: 'unused' };
    }
  });
  setOverride('../../src/usecases/assistant/generatePaidAssistantReply', {
    detectExplicitPaidIntent: () => null,
    classifyPaidIntent: () => 'situation_analysis',
    generatePaidAssistantReply: async () => {
      paidAssistantCalled += 1;
      return { ok: false, blockedReason: 'unused' };
    }
  });
  setOverride('../../src/usecases/assistant/concierge/composeConciergeReply', {
    composeConciergeReply: async () => {
      composeCalled += 1;
      return { ok: true, replyText: 'concierge', auditMeta: null };
    },
    buildConciergeContextSnapshot: () => ({ phase: 'arrival', topTasks: [], blockedTask: null, dueSoonTask: null, updatedAt: null })
  });
  setOverride('../../src/usecases/assistant/opportunity/loadRecentInterventionSignals', {
    loadRecentInterventionSignals: async () => ({
      recentTurns: 5,
      recentInterventions: 0,
      recentClicks: false,
      recentTaskDone: false,
      lastInterventionAt: null
    })
  });
  setOverride('../../src/repos/firestore/faqArticlesRepo', {
    getArticle: async () => null
  });
  setOverride('../../src/repos/firestore/linkRegistryRepo', {
    getLink: async () => null
  });
  setOverride('../../src/repos/firestore/sourceRefsRepo', {
    getSourceRef: async () => null
  });
  setOverride('../../src/repos/firestore/cityPacksRepo', {
    getCityPack: async () => null
  });
  setOverride('../../src/repos/firestore/journeyGraphCatalogRepo', {
    getJourneyGraphCatalog: async () => ({ enabled: false })
  });
  setOverride('../../src/repos/firestore/llmBanditStateRepo', {
    listBanditArmStatesBySegment: async () => []
  });
  setOverride('../../src/repos/firestore/llmContextualBanditStateRepo', {
    listBanditArmStatesByContext: async () => []
  });
  setOverride('../../src/repos/firestore/llmActionLogsRepo', {
    appendLlmActionLog: async (entry) => ({ id: 'log_phase718', data: entry }),
    listLlmActionLogsByLineUserId: async () => []
  });
  setOverride('../../src/usecases/journey/handleJourneyLineCommand', {
    handleJourneyLineCommand: async () => ({ handled: false })
  });
  setOverride('../../src/usecases/journey/handleJourneyPostback', {
    handleJourneyPostback: async () => ({ handled: false })
  });
  setOverride('../../src/repos/firestore/taskNodesRepo', {
    listTaskNodesByLineUserId: async () => []
  });

  overrides.forEach((entry, modulePath) => {
    require.cache[modulePath] = entry.replacement;
  });

  const targetPath = require.resolve('../../src/routes/webhookLine');
  const previousTarget = require.cache[targetPath];
  delete require.cache[targetPath];
  const loaded = require('../../src/routes/webhookLine');

  function restore() {
    delete require.cache[targetPath];
    if (previousTarget) require.cache[targetPath] = previousTarget;
    overrides.forEach((entry, modulePath) => {
      if (entry.previous) require.cache[modulePath] = entry.previous;
      else delete require.cache[modulePath];
    });
  }

  return {
    handleLineWebhook: loaded.handleLineWebhook,
    auditCalls,
    counters: {
      get retrievalCalled() { return retrievalCalled; },
      get composeCalled() { return composeCalled; },
      get paidFaqCalled() { return paidFaqCalled; },
      get paidAssistantCalled() { return paidAssistantCalled; }
    },
    restore
  };
}

function findGateSummary(auditCalls) {
  const gate = auditCalls.find((entry) => entry && entry.action === 'llm_gate.decision');
  return gate && gate.payloadSummary ? gate.payloadSummary : null;
}

test('phase718 smoke: paid greeting keeps casual response and does not emit FAQ候補 text', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    LLM_FEATURE_FLAG: 'true',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false',
    PAID_INTERVENTION_COOLDOWN_TURNS: '5'
  });
  const loaded = loadWebhookWithStubs({});

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('こんにちは');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase718_paid_greeting_runtime',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].text.includes('こんにちは'));
  assert.ok(!replies[0].text.includes('FAQ候補'));
  assert.equal(loaded.counters.retrievalCalled, 0);
  assert.equal(loaded.counters.paidFaqCalled, 0);
  assert.equal(loaded.counters.paidAssistantCalled, 0);
  assert.equal(loaded.counters.composeCalled, 0);

  const summary = findGateSummary(loaded.auditCalls);
  assert.ok(summary);
  assert.equal(summary.conversationMode, 'casual');
  assert.equal(summary.entryType, 'webhook');
});
