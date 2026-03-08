'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const HMAC_SEED = ['phase717', 'paid', 'casual', 'hmac', 'seed'].join('_');

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
        replyToken: 'rt_phase717_paid',
        source: { userId: 'U_PHASE717_PAID' },
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
  let composeCalled = 0;
  let paidFaqCalled = 0;
  let paidAssistantCalled = 0;

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
    getLlmConciergeEnabled: async () => payload.llmConciergeEnabled !== false,
    getLlmWebSearchEnabled: async () => true,
    getLlmStyleEngineEnabled: async () => true,
    getLlmBanditEnabled: async () => false
  });
  setOverride('../../src/usecases/billing/planGate', {
    resolvePlan: async () => ({
      plan: payload.plan || 'pro',
      status: payload.plan === 'free' ? 'none' : 'active'
    })
  });
  setOverride('../../src/usecases/billing/evaluateLlmBudget', {
    evaluateLLMBudget: async () => ({
      allowed: true,
      blockedReason: null,
      policy: {
        model: 'gpt-4o-mini',
        forbidden_domains: []
      }
    })
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
          { key: 'school_registration', status: 'open', due: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() }
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
        replyText: '1. 状況整理\n2. 抜け漏れ\n3. リスク\n4. NextAction\n5. 根拠参照キー',
        output: {
          situation: '学校手続きの優先整理が必要です。',
          nextActions: ['入学条件を確認する', '必要書類を準備する', '提出期限を確認する'],
          evidenceKeys: []
        },
        top1Score: 0.9,
        tokensIn: 10,
        tokensOut: 20,
        model: 'gpt-4o-mini',
        assistantQuality: {
          intentResolved: 'situation_analysis',
          kbTopScore: 0.9,
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
    generatePaidAssistantReply: async () => {
      paidAssistantCalled += 1;
      return { ok: false, blockedReason: 'unused' };
    }
  });
  setOverride('../../src/usecases/assistant/concierge/composeConciergeReply', {
    composeConciergeReply: async () => {
      composeCalled += 1;
      return {
        ok: true,
        replyText: '先回りで1つだけ刺します。\n1. 学校の優先手続きを確定しましょう。',
        auditMeta: {
          topic: 'life_event',
          mode: 'B',
          userTier: 'paid',
          citationRanks: [],
          urlCount: 0,
          urls: [],
          guardDecisions: [],
          blockedReasons: [],
          injectionFindings: false,
          evidenceNeed: 'none',
          evidenceOutcome: 'SUPPORTED',
          chosenAction: null,
          contextVersion: 'concierge_ctx_v1',
          featureHash: 'hash',
          postRenderLint: { findings: [], modified: false },
          contextSignature: null,
          contextualBanditEnabled: false,
          contextualFeatures: null,
          counterfactualSelectedArmId: null,
          counterfactualSelectedRank: null,
          counterfactualTopArms: [],
          counterfactualEval: null
        }
      };
    },
    buildConciergeContextSnapshot: (snapshot) => {
      const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      const topTasks = Array.isArray(source.topOpenTasks) ? source.topOpenTasks.slice(0, 3) : [];
      const dueSoonTask = topTasks[0] || null;
      return {
        phase: source.phase || 'pre',
        topTasks,
        blockedTask: null,
        dueSoonTask,
        updatedAt: null
      };
    }
  });
  setOverride('../../src/usecases/assistant/opportunity/loadRecentInterventionSignals', {
    loadRecentInterventionSignals: async ({ recentTurns }) => {
      const rows = Array.isArray(payload.recentActionLogs) ? payload.recentActionLogs : [];
      const limit = Number.isFinite(Number(recentTurns)) ? Math.max(1, Math.floor(Number(recentTurns))) : 5;
      const recent = rows.slice(0, limit);
      const recentInterventions = recent.filter((row) => row && row.conversationMode === 'concierge').length;
      return {
        recentTurns: limit,
        recentInterventions,
        recentClicks: false,
        recentTaskDone: false,
        lastInterventionAt: recentInterventions > 0 && recent[0] && recent[0].createdAt ? recent[0].createdAt : null
      };
    }
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
    listLlmActionLogsByLineUserId: async () => (Array.isArray(payload.recentActionLogs) ? payload.recentActionLogs : [])
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

function assertNoRetrievalTemplate(text) {
  const message = String(text || '');
  ['FAQ候補', 'CityPack候補', '根拠キー', 'score=', '- [ ]'].forEach((token) => {
    assert.equal(message.includes(token), false, `unexpected token: ${token}`);
  });
}

test('phase717: paid greeting stays casual and skips paid retrieval pipeline', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'true',
    PAID_INTERVENTION_COOLDOWN_TURNS: '5'
  });
  const loaded = loadWebhookWithStubs({ plan: 'pro', recentActionLogs: [] });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('こんにちは');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase717_paid_greeting',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].text.includes('こんにちは'));
  assert.equal(loaded.counters.paidFaqCalled, 0);
  assert.equal(loaded.counters.paidAssistantCalled, 0);
  assert.equal(loaded.counters.retrievalCalled, 0);
  assert.equal(loaded.counters.composeCalled, 0);

  const summary = findGateSummary(loaded.auditCalls);
  assert.ok(summary);
  assert.equal(summary.conversationMode, 'casual');
  assert.equal(summary.opportunityType, 'none');
  assert.equal(summary.interventionBudget, 0);
  assert.equal(loaded.actionLogWrites.length, 1);
  assert.equal(loaded.actionLogWrites[0].conversationMode, 'casual');
  assert.equal(loaded.actionLogWrites[0].opportunityType, 'none');
});

test('phase717: paid greeting stays casual even when opportunity engine flag is disabled', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false'
  });
  const loaded = loadWebhookWithStubs({ plan: 'pro', recentActionLogs: [] });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('こんにちは');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase717_paid_greeting_flag_off',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].text.includes('こんにちは'));
  assert.equal(loaded.counters.paidFaqCalled, 0);
  assert.equal(loaded.counters.paidAssistantCalled, 0);
  assert.equal(loaded.counters.retrievalCalled, 0);
  assert.equal(loaded.counters.composeCalled, 0);

  const summary = findGateSummary(loaded.auditCalls);
  assert.ok(summary);
  assert.equal(summary.conversationMode, 'casual');
  assert.equal(summary.opportunityType, 'none');
  assert.equal(summary.interventionBudget, 0);
  assert.ok(Array.isArray(summary.opportunityReasonKeys));
  assert.ok(summary.opportunityReasonKeys.includes('greeting_detected'));
});

test('phase717: paid opportunity keyword triggers concierge intervention once', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'true',
    PAID_INTERVENTION_COOLDOWN_TURNS: '5'
  });
  const loaded = loadWebhookWithStubs({ plan: 'pro', recentActionLogs: [] });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('税金どうしよう');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase717_paid_intervention',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assertNoRetrievalTemplate(replies[0].text);
  assert.equal(loaded.counters.retrievalCalled, 0);

  const summary = findGateSummary(loaded.auditCalls);
  assert.ok(summary);
  assert.equal(summary.conversationMode, 'concierge');
  assert.equal(summary.opportunityType, 'action');
  assert.equal(summary.interventionBudget, 1);
  assert.equal(loaded.actionLogWrites.length, 1);
  assert.equal(loaded.actionLogWrites[0].conversationMode, 'concierge');
  assert.equal(loaded.actionLogWrites[0].opportunityType, 'action');
});

test('phase717: cooldown suppresses consecutive interventions for paid opportunity keywords', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'true',
    PAID_INTERVENTION_COOLDOWN_TURNS: '5'
  });
  const loaded = loadWebhookWithStubs({
    plan: 'pro',
    recentActionLogs: [
      {
        createdAt: new Date().toISOString(),
        conversationMode: 'concierge',
        opportunityType: 'action',
        rewardSignals: {
          click: false,
          taskDone: false
        }
      }
    ]
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('税金どうしよう');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase717_paid_cooldown',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.equal(loaded.counters.paidFaqCalled, 0);
  assert.equal(loaded.counters.composeCalled, 0);

  const summary = findGateSummary(loaded.auditCalls);
  assert.ok(summary);
  assert.equal(summary.conversationMode, 'casual');
  assert.equal(summary.opportunityType, 'action');
  assert.equal(summary.interventionBudget, 0);
  assert.ok(Array.isArray(summary.opportunityReasonKeys));
  assert.ok(summary.opportunityReasonKeys.includes('intervention_cooldown_active'));
  assert.equal(loaded.actionLogWrites.length, 1);
  assert.equal(loaded.actionLogWrites[0].conversationMode, 'casual');
  assert.equal(loaded.actionLogWrites[0].opportunityType, 'action');
});

test('phase717: housing intent keeps concierge even when cooldown is active', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'true',
    PAID_INTERVENTION_COOLDOWN_TURNS: '5'
  });
  const loaded = loadWebhookWithStubs({
    plan: 'pro',
    recentActionLogs: [
      {
        createdAt: new Date().toISOString(),
        conversationMode: 'concierge',
        opportunityType: 'action'
      }
    ]
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('賃貸で部屋探ししたい');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase717_paid_housing_cooldown_override',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assertNoRetrievalTemplate(replies[0].text);
  assert.equal(loaded.counters.retrievalCalled, 0);
  assert.equal(loaded.counters.paidFaqCalled, 0);
  assert.equal(loaded.counters.composeCalled, 0);

  const summary = findGateSummary(loaded.auditCalls);
  assert.ok(summary);
  assert.equal(summary.conversationMode, 'concierge');
  assert.equal(summary.routerReason, 'housing_intent_detected');
  assert.ok(Array.isArray(summary.opportunityReasonKeys));
  assert.ok(summary.opportunityReasonKeys.includes('housing_intent'));
  assert.equal(loaded.actionLogWrites.length, 1);
  assert.equal(loaded.actionLogWrites[0].conversationMode, 'concierge');
});

test('phase717: free path keeps retrieval-first behavior', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'true'
  });
  const loaded = loadWebhookWithStubs({
    plan: 'free',
    llmConciergeEnabled: false
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('学校どうしよう');
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase717_free_retrieval',
    logger: () => {},
    allowWelcome: false,
    replyFn: async () => {}
  });

  assert.equal(result.status, 200);
  assert.equal(loaded.counters.retrievalCalled, 1);
  assert.equal(loaded.counters.paidFaqCalled, 0);
});
