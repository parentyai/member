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
      return {
        allowed: true,
        blockedReason: null,
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
    evaluateLlmAvailability: async () => ({ available: true })
  });
  setOverride('../../src/usecases/context/getUserContextSnapshot', {
    getUserContextSnapshot: async () => ({
      ok: true,
      stale: false,
      snapshot: {
        phase: 'arrival',
        topOpenTasks: [
          { key: 'school_registration', status: 'open', due: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() }
        ],
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
