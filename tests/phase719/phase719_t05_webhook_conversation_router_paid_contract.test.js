'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const HMAC_SEED = ['phase719', 'router', 'paid', 'hmac', 'seed'].join('_');

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
        replyToken: 'rt_phase719_router',
        source: { userId: 'U_PHASE719_ROUTER' },
        message: { type: 'text', text }
      }
    ]
  });
}

function loadWebhookWithStubs(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const auditCalls = [];
  const actionLogWrites = [];
  let retrievalCalled = 0;
  let paidFaqCalled = 0;
  let budgetCalled = 0;

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
    getLlmConciergeEnabled: async () => true,
    getLlmWebSearchEnabled: async () => true,
    getLlmStyleEngineEnabled: async () => true,
    getLlmBanditEnabled: async () => false
  });
  setOverride('../../src/usecases/billing/planGate', {
    resolvePlan: async () => ({ plan: 'pro', status: 'active' })
  });
  setOverride('../../src/usecases/billing/evaluateLlmBudget', {
    evaluateLLMBudget: async () => {
      budgetCalled += 1;
      const allowed = payload.budgetAllowed !== false;
      return {
        allowed,
        blockedReason: allowed ? null : (payload.budgetBlockedReason || 'plan_gate_blocked'),
        policy: {
          model: 'gpt-4o-mini',
          forbidden_domains: []
        }
      };
    }
  });
  setOverride('../../src/usecases/assistant/recordLlmUsage', {
    recordLlmUsage: async () => ({ costEstimate: 0 })
  });
  setOverride('../../src/usecases/assistant/llmAvailabilityGate', {
    evaluateLlmAvailability: async () => ({
      available: payload.availabilityAvailable !== false,
      reason: payload.availabilityAvailable === false ? (payload.availabilityReason || 'llm_unavailable') : null
    })
  });
  setOverride('../../src/usecases/context/getUserContextSnapshot', {
    getUserContextSnapshot: async () => {
      if (payload.snapshotResult && typeof payload.snapshotResult === 'object') {
        return payload.snapshotResult;
      }
      return {
        ok: true,
        stale: false,
        snapshot: {
          phase: 'arrival',
          topOpenTasks: [
            { key: 'school_registration', status: 'open', due: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() }
          ],
          riskFlags: []
        }
      };
    }
  });
  setOverride('../../src/usecases/assistant/generateFreeRetrievalReply', {
    generateFreeRetrievalReply: async () => {
      retrievalCalled += 1;
      return {
        ok: true,
        mode: 'ranked',
        replyText: 'FREE RETRIEVAL BASE',
        citations: ['kb_1'],
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
      const ok = payload.paidFaqOk !== false;
      if (!ok) {
        return {
          ok: false,
          blockedReason: payload.paidFaqBlockedReason || 'llm_error',
          assistantQuality: {
            intentResolved: 'situation_analysis',
            kbTopScore: 0,
            evidenceCoverage: 0,
            blockedStage: 'paid_generation',
            fallbackReason: payload.paidFaqBlockedReason || 'llm_error'
          }
        };
      }
      return {
        ok: true,
        qualityWarning: null,
        replyText: 'PAID FAQ REPLY',
        output: {
          situation: '学校手続きの整理',
          nextActions: ['要件確認'],
          evidenceKeys: []
        },
        top1Score: 0.8,
        tokensIn: 10,
        tokensOut: 20,
        model: 'gpt-4o-mini',
        assistantQuality: {
          intentResolved: 'situation_analysis',
          kbTopScore: 0.8,
          evidenceCoverage: 0,
          blockedStage: null,
          fallbackReason: null
        }
      };
    }
  });
  setOverride('../../src/usecases/assistant/generatePaidAssistantReply', {
    detectExplicitPaidIntent: () => null,
    classifyPaidIntent: () => 'situation_analysis',
    generatePaidAssistantReply: async () => ({ ok: false, blockedReason: 'unused' })
  });
  setOverride('../../src/usecases/assistant/concierge/composeConciergeReply', {
    composeConciergeReply: async ({ baseReplyText }) => ({
      ok: true,
      replyText: baseReplyText,
      auditMeta: null
    }),
    buildConciergeContextSnapshot: (snapshot) => {
      const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      const topTasks = Array.isArray(source.topOpenTasks) ? source.topOpenTasks.slice(0, 3) : [];
      return {
        phase: source.phase || 'pre',
        topTasks,
        blockedTask: null,
        dueSoonTask: topTasks[0] || null,
        updatedAt: null
      };
    }
  });
  setOverride('../../src/usecases/assistant/opportunity/loadRecentInterventionSignals', {
    loadRecentInterventionSignals: async () => ({ recentTurns: 5, recentInterventions: 0, recentClicks: false, recentTaskDone: false })
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
    appendLlmActionLog: async (entry) => {
      actionLogWrites.push(entry);
      return { id: 'log_1', data: entry };
    },
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
    actionLogWrites,
    counters: {
      get retrievalCalled() { return retrievalCalled; },
      get paidFaqCalled() { return paidFaqCalled; },
      get budgetCalled() { return budgetCalled; }
    },
    restore
  };
}

function findGateSummary(auditCalls) {
  const gate = auditCalls.find((entry) => entry && entry.action === 'llm_gate.decision');
  return gate && gate.payloadSummary ? gate.payloadSummary : null;
}

function assertNoRetrievalTemplate(text) {
  const message = String(text || '');
  ['FAQ候補', 'CityPack候補', '根拠キー', 'score=', '- [ ]'].forEach((token) => {
    assert.equal(message.includes(token), false, `unexpected token: ${token}`);
  });
}

test('phase719: router-enabled paid greeting bypasses budget and retrieval with routerReason in audit', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_CONVERSATION_ROUTER: 'true',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false'
  });
  const loaded = loadWebhookWithStubs();

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('こんにちは');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase719_router_enabled_greeting',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].text.includes('こんにちは'));
  assert.equal(loaded.counters.budgetCalled, 0);
  assert.equal(loaded.counters.retrievalCalled, 0);
  assert.equal(loaded.counters.paidFaqCalled, 0);

  const summary = findGateSummary(loaded.auditCalls);
  assert.ok(summary);
  assert.equal(summary.conversationMode, 'casual');
  assert.equal(summary.routerReason, 'greeting_detected');
});

test('phase719: router-disabled paid greeting keeps legacy order and evaluates budget before casual reply', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_CONVERSATION_ROUTER: 'false',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false'
  });
  const loaded = loadWebhookWithStubs();

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('こんにちは');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase719_router_disabled_greeting',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].text.includes('こんにちは'));
  assert.equal(loaded.counters.budgetCalled > 0, true);
  assert.equal(loaded.counters.retrievalCalled, 0);
});

test('phase719: paid domain intents never fall back to free retrieval across blocked paths', { concurrency: false }, async (t) => {
  const scenarios = [
    {
      name: 'budget_blocked',
      env: {},
      stubs: { budgetAllowed: false, budgetBlockedReason: 'llm_disabled' }
    },
    {
      name: 'availability_blocked',
      env: {},
      stubs: { availabilityAvailable: false, availabilityReason: 'llm_unavailable' }
    },
    {
      name: 'snapshot_blocked',
      env: { ENABLE_SNAPSHOT_ONLY_CONTEXT_V1: 'true' },
      stubs: { snapshotResult: { ok: false, reason: 'snapshot_unavailable' } }
    },
    {
      name: 'paid_generation_failure_like',
      env: {},
      stubs: { paidFaqOk: false, paidFaqBlockedReason: 'llm_error' }
    }
  ];
  const domains = [
    { key: 'housing', text: '部屋探ししたい' },
    { key: 'school', text: '学校手続きどうする？' },
    { key: 'ssn', text: 'SSN申請どうする？' },
    { key: 'banking', text: 'bank account を作りたい' }
  ];

  for (const domain of domains) {
    for (const scenario of scenarios) {
      const restoreEnv = withEnv(Object.assign({
        LINE_CHANNEL_SECRET: HMAC_SEED,
        ENABLE_CONVERSATION_ROUTER: 'true',
        ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'true'
      }, scenario.env));
      const loaded = loadWebhookWithStubs(scenario.stubs);
      const replies = [];

      try {
        const body = createWebhookBody(domain.text);
        const result = await loaded.handleLineWebhook({
          body,
          signature: signBody(body),
          requestId: `phase719_${domain.key}_${scenario.name}`,
          logger: () => {},
          allowWelcome: false,
          replyFn: async (_replyToken, message) => {
            replies.push(message);
          }
        });

        assert.equal(result.status, 200, `${domain.key}_${scenario.name}`);
        assert.equal(replies.length, 1, `${domain.key}_${scenario.name}`);
        assertNoRetrievalTemplate(replies[0].text);
        assert.equal(loaded.counters.retrievalCalled, 0, `${domain.key}_${scenario.name}`);

        const summary = findGateSummary(loaded.auditCalls);
        assert.ok(summary, `${domain.key}_${scenario.name}`);
        assert.equal(summary.conversationMode, 'concierge', `${domain.key}_${scenario.name}`);
        assert.equal(summary.routerReason, `${domain.key}_intent_detected`, `${domain.key}_${scenario.name}`);
        assert.ok(Array.isArray(summary.opportunityReasonKeys), `${domain.key}_${scenario.name}`);
        assert.ok(summary.opportunityReasonKeys.includes(`${domain.key}_intent`), `${domain.key}_${scenario.name}`);
      } finally {
        loaded.restore();
        restoreEnv();
      }
    }
  }
});
