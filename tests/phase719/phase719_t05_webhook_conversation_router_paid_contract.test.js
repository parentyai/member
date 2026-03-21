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

function createWebhookBody(text, userId) {
  const uniqueId = `phase719_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return JSON.stringify({
    events: [
      {
        webhookEventId: uniqueId,
        timestamp: Date.now(),
        type: 'message',
        replyToken: 'rt_phase719_router',
        source: { type: 'user', userId: userId || 'U_PHASE719_ROUTER' },
        message: { id: `${uniqueId}_message`, type: 'text', text }
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
    declareCityRegionFromLine: async () => (payload.regionResponse || { status: 'none' })
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
    getLlmPolicy: async () => ({
      lawful_basis: 'consent',
      consent_required: false,
      cross_border_transfer_allowed: true,
      risk_control: {
        official_source_required: false,
        stale_after_days: 30
      }
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
      const stored = Object.assign({
        createdAt: new Date().toISOString()
      }, entry);
      actionLogWrites.push(stored);
      return { id: `log_${actionLogWrites.length}`, data: stored };
    },
    listLlmActionLogsByLineUserId: async () => (
      payload.useActionLogHistory === true
        ? actionLogWrites.slice()
        : (Array.isArray(payload.recentActionRows) ? payload.recentActionRows : [])
    )
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

function assertNoInternalConciergeLabels(text) {
  const message = String(text || '');
  [
    'domain_concierge_candidate',
    'clarify_candidate',
    'fallbackType',
    'routerReason',
    'contextual_domain_resume',
    'opportunityReasonKeys',
    'FAQ候補',
    'CityPack候補',
    '根拠キー'
  ].forEach((token) => {
    assert.equal(message.includes(token), false, `unexpected internal label: ${token}`);
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
  assert.equal(summary.orchestratorPathUsed, true);
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

test('phase719: ambiguous short utterance resumes recent school context via orchestrator', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_CONVERSATION_ROUTER: 'true',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false',
    ENABLE_PAID_ORCHESTRATOR_V2: 'true'
  });
  const loaded = loadWebhookWithStubs({
    recentActionRows: [
      {
        createdAt: '2026-03-08T20:30:00.000Z',
        domainIntent: 'school',
        committedFollowupQuestion: '優先したい手続きを1つだけ教えてください。'
      }
    ]
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('ヒザ');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase719_context_resume_school',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.equal(loaded.counters.retrievalCalled, 0);
  assert.ok(
    replies[0].text.includes('学校') || replies[0].text.includes('手続き'),
    `unexpected reply: ${replies[0].text}`
  );

  const summary = findGateSummary(loaded.auditCalls);
  assert.ok(summary);
  assert.equal(summary.routerReason, 'contextual_domain_resume');
  assert.equal(summary.conversationMode, 'concierge');
  assert.equal(summary.contextResumeDomain, 'school');
  assert.equal(summary.orchestratorPathUsed, true);
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

test('phase719: non-empty outbound paid reply keeps transcript snapshot assistant reply telemetry present', { concurrency: false }, async (t) => {
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

  const body = createWebhookBody('学校手続きどうする？');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase719_transcript_reply_handoff',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.equal(Boolean(replies[0].text && replies[0].text.trim()), true);
  assert.equal(loaded.actionLogWrites.length > 0, true);
  assert.equal(loaded.actionLogWrites[0].transcriptSnapshotAssistantReplyPresent, true);
  assert.equal(loaded.actionLogWrites[0].transcriptSnapshotAssistantReplyLength > 0, true);
  assert.notEqual(loaded.actionLogWrites[0].transcriptSnapshotBuildSkippedReason, 'assistant_reply_missing');
});

test('phase719: gate-blocked domain concierge fallback keeps transcript snapshot assistant reply telemetry present', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_CONVERSATION_ROUTER: 'true',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'true'
  });
  const loaded = loadWebhookWithStubs({
    budgetAllowed: false,
    budgetBlockedReason: 'llm_disabled'
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('部屋探ししたい');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase719_transcript_reply_handoff_gate_blocked',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.equal(Boolean(replies[0].text && replies[0].text.trim()), true);
  assert.equal(loaded.actionLogWrites.length > 0, true);
  assert.equal(loaded.actionLogWrites[0].transcriptSnapshotAssistantReplyPresent, true);
  assert.equal(loaded.actionLogWrites[0].transcriptSnapshotAssistantReplyLength > 0, true);
  assert.notEqual(loaded.actionLogWrites[0].transcriptSnapshotBuildSkippedReason, 'assistant_reply_missing');
});

test('phase719: paid conversation sequence avoids generic reset for planning, pricing, and mixed-domain prompts', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_CONVERSATION_ROUTER: 'true',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false',
    ENABLE_PAID_ORCHESTRATOR_V2: 'true'
  });
  const loaded = loadWebhookWithStubs({
    useActionLogHistory: true
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const inputs = [
    '今の自分の状況から、最初に何を優先すべきか3つだけ教えて。',
    'それなら最初の5分は何をする？',
    '今日はかなり疲れてる前提だと、どう言い換える？',
    '今の進め方で足りていないものがあれば、3つまでで教えて。',
    '今日・今週・今月の順で短く並べて。',
    '無料プランと有料プランの違いを、回りくどくなく短く教えて。',
    '引っ越しと学校の手続きが同時に不安。まず何から確認すべきか順番だけ教えて。'
  ];
  const replies = [];
  const sequenceUserId = 'U_PHASE719_SEQUENCE';

  for (const [index, text] of inputs.entries()) {
    const body = createWebhookBody(text, sequenceUserId);
    const turnReplies = [];
    const result = await loaded.handleLineWebhook({
      body,
      signature: signBody(body),
      requestId: `phase719_paid_sequence_${index + 1}`,
      logger: () => {},
      allowWelcome: false,
      replyFn: async (_replyToken, message) => {
        turnReplies.push(message);
      }
    });

    assert.equal(result.status, 200, `turn_${index + 1}`);
    assert.equal(turnReplies.length, 1, `turn_${index + 1}`);
    replies.push(String(turnReplies[0].text || ''));
  }

  assert.equal(replies.length, inputs.length);
  assert.notEqual(replies[0], replies[1]);
  assert.notEqual(replies[1], replies[2]);
  assert.match(replies[1], /最初の5分|期限|窓口/);
  assert.match(replies[2], /疲れている前提|今週/);
  assert.match(replies[3], /優先順位|期限|次の一手/);
  assert.match(replies[4], /今日:/);
  assert.match(replies[5], /無料/);
  assert.match(replies[5], /有料/);
  assert.equal(replies[5].includes('優先する手続きを3つ以内に絞る'), false);
  assert.match(replies[6], /学区|学校/);
  assert.match(replies[6], /住むエリア|住居/);
  assert.match(replies[6], /住所証明/);
  assert.match(replies[6], /同じエリア軸/);
  assert.match(replies[6], /順番は、住むエリアと学区/);
  assert.equal(replies[6].includes('次は順番は'), false);

  const lastWrite = loaded.actionLogWrites[loaded.actionLogWrites.length - 1];
  assert.equal(loaded.actionLogWrites.length >= inputs.length, true);
  assert.equal(lastWrite.transcriptSnapshotAssistantReplyPresent, true);
  assert.equal(lastWrite.transcriptSnapshotAssistantReplyLength > 0, true);
});

test('phase719: paid conversation sequence handles kickoff, rewrite, correction, criteria, and template prompts without generic reset', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_CONVERSATION_ROUTER: 'true',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false',
    ENABLE_PAID_ORCHESTRATOR_V2: 'true'
  });
  const loaded = loadWebhookWithStubs({
    useActionLogHistory: true
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const inputs = [
    'アメリカ赴任の準備って何から始めればいいですか？',
    'それなら最初の5分は何をする？',
    '今日はかなり疲れてる前提だと、どう言い換える？',
    '今の進め方で足りていないものがあれば、3つまでで教えて。',
    '今日・今週・今月の順で短く並べて。',
    '無料プランと有料プランの違いを、回りくどくなく短く教えて。',
    '引っ越しと学校の手続きが同時に不安。まず何から確認すべきか順番だけ教えて。',
    'SSNと銀行口座の手続き、先にどっちを進めるべきか理由つきで短く教えて。',
    'さっきの説明を、家族に送れる一文にして。',
    '今の返答の中で、今日やることだけ1行にして。',
    'それは違う。学校じゃなくて住まい優先で考え直して。',
    '不安が強い前提で、やることを1つだけに絞って。',
    '公式情報を確認すべき場面かどうか、判断基準だけ教えて。',
    '予約が必要かどうかを相手に失礼なく聞く短文を1つ作って。',
    'ここまでの会話を踏まえて、次の一手だけを断定せずに提案して。'
  ];
  const replies = [];
  const sequenceUserId = 'U_PHASE719_SEQUENCE_UTILITY';

  for (const [index, text] of inputs.entries()) {
    const body = createWebhookBody(text, sequenceUserId);
    const turnReplies = [];
    const result = await loaded.handleLineWebhook({
      body,
      signature: signBody(body),
      requestId: `phase719_paid_utility_${index + 1}`,
      logger: () => {},
      allowWelcome: false,
      replyFn: async (_replyToken, message) => {
        turnReplies.push(message);
      }
    });

    assert.equal(result.status, 200, `turn_${index + 1}`);
    assert.equal(turnReplies.length, 1, `turn_${index + 1}`);
    replies.push(String(turnReplies[0].text || ''));
  }

  assert.match(replies[0], /期限がある手続き|生活基盤/);
  assert.equal(replies[0].includes('優先したい手続きを1つだけ教えてください'), false);
  assert.match(replies[7], /先にSSN/);
  assert.match(replies[7], /理由/);
  assert.equal(String(replies[8] || '').split('\n').length, 1);
  assert.match(replies[8], /SSN|整理しやすく/);
  assert.equal(String(replies[9] || '').split('\n').length, 1);
  assert.match(replies[9], /今日は最優先/);
  assert.match(replies[10], /住まい優先/);
  assert.match(replies[10], /入居時期|希望エリア/);
  assert.equal(String(replies[11] || '').split('\n').length, 1);
  assert.match(replies[11], /期限だけ確認/);
  assert.match(replies[12], /制度・期限・必要書類・費用/);
  assert.match(replies[12], /公式窓口/);
  assert.equal(String(replies[13] || '').split('\n').length, 1);
  assert.match(replies[13], /事前予約が必要かどうか/);
  assert.match(replies[14], /事前予約が必要かどうか/);
  assert.match(replies[14], /助かります/);

  replies.slice(8).forEach((reply) => {
    assert.equal(reply.includes('まずは次の一手から進めましょう'), false);
    assert.equal(reply.includes('優先したい手続きがあれば1つだけ教えてください'), false);
  });
});

test('phase719: region already-set command does not hijack natural language prompts and rewrite followups stay non-generic', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_CONVERSATION_ROUTER: 'true',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false',
    ENABLE_PAID_ORCHESTRATOR_V2: 'true'
  });
  const loaded = loadWebhookWithStubs({
    useActionLogHistory: true,
    regionResponse: { status: 'already_set', regionKey: 'wa::seattle' }
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const inputs = [
    '地域によって違うなら、何を確認すべきかだけ教えて。',
    '今の返し、少し硬い。人に話す感じで2文にして。',
    '違う、やさしくしたいんじゃなくて、事務的すぎない文面にしたい。',
    'それも違う。今ほしいのは説明じゃなくて、相手に送る文面だけ。'
  ];
  const replies = [];
  const sequenceUserId = 'U_PHASE719_REGION_COLLISION';

  for (const [index, text] of inputs.entries()) {
    const body = createWebhookBody(text, sequenceUserId);
    const turnReplies = [];
    const result = await loaded.handleLineWebhook({
      body,
      signature: signBody(body),
      requestId: `phase719_paid_region_${index + 1}`,
      logger: () => {},
      allowWelcome: false,
      replyFn: async (_replyToken, message) => {
        turnReplies.push(message);
      }
    });

    assert.equal(result.status, 200, `turn_${index + 1}`);
    assert.equal(turnReplies.length, 1, `turn_${index + 1}`);
    replies.push(String(turnReplies[0].text || ''));
  }

  assert.equal(replies[0].includes('地域は既に登録済みです'), false);
  assert.match(replies[0], /確認|制度|窓口|地域/);
  assert.equal(String(replies[1] || '').split('\n').length, 2);
  assert.match(replies[1], /窓口|受付期限|判断しやすく/);
  assert.equal(String(replies[2] || '').split('\n').length, 1);
  assert.match(replies[2], /地域差|窓口|受付期限|安心/);
  assert.equal(String(replies[3] || '').split('\n').length, 1);
  assert.match(replies[3], /対象地域の窓口|受付期限|確認してみます/);

  replies.forEach((reply) => {
    assert.equal(reply.includes('まずは次の一手から進めましょう'), false);
    assert.equal(reply.includes('優先したい手続きがあれば1つだけ教えてください'), false);
    assertNoInternalConciergeLabels(reply);
  });
  [2, 3].forEach((index) => {
    assert.equal(String(replies[index] || '').includes('・'), false, `turn_${index + 1}_one_line_no_bullet`);
  });
});

test('phase719: live transcript regression sequence keeps reverse correction, message-only rewrite, and soft followups on-topic', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_CONVERSATION_ROUTER: 'true',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false',
    ENABLE_PAID_ORCHESTRATOR_V2: 'true'
  });
  const loaded = loadWebhookWithStubs({
    useActionLogHistory: true,
    regionResponse: { status: 'already_set', regionKey: 'wa::seattle' }
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const inputs = [
    '住まい探しと学校手続きが同時に不安。先に何を見るべきか順番だけ教えて。',
    'それは違う。学校じゃなくて住まい優先で考え直して。',
    '今度は逆で、住まいより学校優先で考え直して。',
    'SSNと銀行口座、先にどっちを進めるべきか理由つきで短く教えて。',
    'さっきの説明を、家族に送れる一文にして。',
    '今の返答の中で、今日やることだけ1行にして。',
    'それも違う。今ほしいのは説明じゃなくて、相手に送る文面だけ。',
    '予約が必要かどうかを、失礼なく聞く短文を1つ作って。',
    '今の文面を、断定しすぎない言い方に直して。',
    '公式情報を確認すべき場面かどうか、判断基準だけ教えて。',
    '地域によって違うなら、何を確認すべきかだけ教えて。',
    '今の返し、少し硬い。人に話す感じで2文にして。',
    '違う、やさしくしたいんじゃなくて、事務的すぎない文面にしたい。',
    'ここまでを踏まえて、次の一手だけをやわらかく提案して。'
  ];
  const replies = [];
  const sequenceUserId = 'U_PHASE719_LIVE_REGRESSION';

  for (const [index, text] of inputs.entries()) {
    const body = createWebhookBody(text, sequenceUserId);
    const turnReplies = [];
    const result = await loaded.handleLineWebhook({
      body,
      signature: signBody(body),
      requestId: `phase719_live_regression_${index + 1}`,
      logger: () => {},
      allowWelcome: false,
      replyFn: async (_replyToken, message) => {
        turnReplies.push(message);
      }
    });

    assert.equal(result.status, 200, `turn_${index + 1}`);
    assert.equal(turnReplies.length, 1, `turn_${index + 1}`);
    replies.push(String(turnReplies[0].text || ''));
  }

  assert.match(replies[2], /学校優先|学区|対象校/);
  assert.equal(replies[2].includes('住まい探しですね'), false);
  assert.equal(String(replies[6] || '').split('\n').length, 1);
  assert.equal(replies[6].includes('まずはSSN手続き'), false);
  assert.match(replies[7], /事前予約が必要かどうか/);
  assert.equal(String(replies[8] || '').split('\n').length, 1);
  assert.equal(replies[8].includes('まずはSSN手続き'), false);
  assert.match(replies[8], /(もし|差し支えなければ|助かります|無理が少なそう)/);
  assert.match(replies[10], /対象地域|窓口|必要書類|受付期限/);
  assert.equal(replies[10].includes('地域は既に登録済みです'), false);
  assert.equal(String(replies[11] || '').split('\n').length, 2);
  assert.equal(replies[11].includes('SSN'), false);
  assert.equal(String(replies[12] || '').split('\n').length, 1);
  assert.equal(replies[12].includes('まずはSSN手続き'), false);
  assert.match(replies[13], /地域差|窓口|受付期限|安心かもしれません/);

  replies.forEach((reply, index) => {
    assert.equal(reply.includes('いまの状況を整理します。'), false, `turn_${index + 1}_generic_reset`);
    assert.equal(reply.includes('いま一番困っている手続きを1つだけ教えてください'), false, `turn_${index + 1}_generic_followup`);
    assertNoInternalConciergeLabels(reply);
  });
});

test('phase719: source-aware live sequence keeps echo and rewrite transforms anchored to the prior reply', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_CONVERSATION_ROUTER: 'true',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false',
    ENABLE_PAID_ORCHESTRATOR_V2: 'true'
  });
  const loaded = loadWebhookWithStubs({
    useActionLogHistory: true,
    regionResponse: { status: 'already_set', regionKey: 'wa::seattle' }
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const inputs = [
    '住まい探しと学校手続きが同時に不安。先に何を見るべきか順番だけ教えて。',
    '次に、住所証明など共通で使う書類をまとめます。',
    'SSNと銀行口座、先にどっちを進めるべきか理由つきで短く教えて。',
    'さっきの説明を、家族に送れる一文にして。',
    '今の返答の中で、今日やることだけ1行にして。',
    'それも違う。今ほしいのは説明じゃなくて、相手に送る文面だけ。',
    '予約が必要かどうかを、失礼なく聞く短文を1つ作って。',
    '今の文面を、断定しすぎない言い方に直して。',
    '公式情報を確認すべき場面かどうか、判断基準だけ教えて。',
    '今の返し、少し硬い。人に話す感じで2文にして。',
    '違う、やさしくしたいんじゃなくて、事務的すぎない文面にしたい。'
  ];
  const replies = [];
  const sequenceUserId = 'U_PHASE719_SOURCE_ANCHORED';

  for (const [index, text] of inputs.entries()) {
    const body = createWebhookBody(text, sequenceUserId);
    const turnReplies = [];
    const result = await loaded.handleLineWebhook({
      body,
      signature: signBody(body),
      requestId: `phase719_source_anchored_${index + 1}`,
      logger: () => {},
      allowWelcome: false,
      replyFn: async (_replyToken, message) => {
        turnReplies.push(message);
      }
    });

    assert.equal(result.status, 200, `turn_${index + 1}`);
    assert.equal(turnReplies.length, 1, `turn_${index + 1}`);
    replies.push(String(turnReplies[0].text || ''));
  }

  assert.match(replies[1], /住所証明/);
  assert.match(replies[1], /住居候補|学校候補/);
  assert.equal(replies[1].includes('住まいの優先条件'), false);
  assert.match(replies[3], /SSN/);
  assert.equal(replies[3].includes('大丈夫そうだよ'), false);
  assert.match(replies[5], /今日は最優先/);
  assert.equal(replies[5].includes('教えてもらえると助かります'), false);
  assert.match(replies[7], /事前予約/);
  assert.equal(replies[7].includes('優先するもの'), false);
  assert.equal(replies[7].includes('もしよければ、もし差し支えなければ'), false);
  assert.match(replies[10], /制度や期限|公式情報/);
  assert.equal(replies[10].includes('順番を一緒に整理'), false);

  replies.forEach((reply, index) => {
    assert.equal(reply.includes('いまの状況を整理します。'), false, `turn_${index + 1}_generic_reset`);
    assert.equal(reply.includes('いま一番困っている手続きを1つだけ教えてください'), false, `turn_${index + 1}_generic_followup`);
    assertNoInternalConciergeLabels(reply);
  });
});

test('phase719: echoed prior assistant line inherits matched prior domain instead of stale unrelated domain', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_CONVERSATION_ROUTER: 'true',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false',
    ENABLE_PAID_ORCHESTRATOR_V2: 'true'
  });
  const loaded = loadWebhookWithStubs({
    useActionLogHistory: true,
    regionResponse: { status: 'already_set', regionKey: 'wa::seattle' }
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const sequenceUserId = 'U_PHASE719_ECHO_MATCH';
  const inputs = [
    'SSNと銀行口座、先にどっちを進めるべきか理由つきで短く教えて。',
    '公式情報を確認すべき場面かどうか、判断基準だけ教えて。',
    '特に申請可否や法的条件に触れるときは、案内より先に公式窓口で最終確認してください。'
  ];
  const replies = [];

  for (const [index, text] of inputs.entries()) {
    const body = createWebhookBody(text, sequenceUserId);
    const turnReplies = [];
    const result = await loaded.handleLineWebhook({
      body,
      signature: signBody(body),
      requestId: `phase719_echo_match_${index + 1}`,
      logger: () => {},
      allowWelcome: false,
      replyFn: async (_replyToken, message) => {
        turnReplies.push(message);
      }
    });

    assert.equal(result.status, 200, `turn_${index + 1}`);
    assert.equal(turnReplies.length, 1, `turn_${index + 1}`);
    replies.push(String(turnReplies[0].text || ''));
  }

  assert.match(replies[1], /制度・期限・必要書類・費用/);
  assert.equal(replies[2].includes('SSN'), false);
  assert.equal(replies[2].includes('在留ステータス'), false);
  assert.equal(replies[2].includes('まずはSSN手続き'), false);
  assert.equal(replies[2].includes('いまの状況を整理します。'), false);
});

test('phase719: echoed assistant lines continue from source reply without wrong-domain correction or generic reset', { concurrency: false }, async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: HMAC_SEED,
    ENABLE_CONVERSATION_ROUTER: 'true',
    ENABLE_PAID_OPPORTUNITY_ENGINE_V1: 'false',
    ENABLE_PAID_ORCHESTRATOR_V2: 'true'
  });
  const loaded = loadWebhookWithStubs({
    useActionLogHistory: true,
    regionResponse: { status: 'already_set', regionKey: 'wa::seattle' }
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const sequenceUserId = 'U_PHASE719_ECHO_RESIDUALS';
  const inputs = [
    'アメリカ赴任の準備って、最初の順番だけ短く教えて。',
    'まずは住まい・学校・SSNなど、後続に影響するものを1つだけ先に固定しましょう。',
    '今の進め方で足りていないものを、2つだけ教えて。',
    'この2つが決まると、進め方がかなり安定します。',
    'SSNと銀行口座、先にどっちを進めるべきか理由つきで短く教えて。',
    '理由は、本人確認や就労まわりの手続きとつながりやすく、後続の判断材料になりやすいからです。',
    '地域によって違うなら、何を確認すべきかだけ教えて。',
    '制度名が分かるなら、その3点だけ見れば判断しやすくなります。'
  ];
  const replies = [];

  for (const [index, text] of inputs.entries()) {
    const body = createWebhookBody(text, sequenceUserId);
    const turnReplies = [];
    const result = await loaded.handleLineWebhook({
      body,
      signature: signBody(body),
      requestId: `phase719_echo_residuals_${index + 1}`,
      logger: () => {},
      allowWelcome: false,
      replyFn: async (_replyToken, message) => {
        turnReplies.push(message);
      }
    });

    assert.equal(result.status, 200, `turn_${index + 1}`);
    assert.equal(turnReplies.length, 1, `turn_${index + 1}`);
    replies.push(String(turnReplies[0].text || ''));
  }

  assert.match(replies[1], /住むエリア|学区/);
  assert.match(replies[1], /SSN/);
  assert.equal(replies[1].includes('学校優先'), false);
  assert.equal(replies[1].includes('住まい優先'), false);
  assert.equal(replies[3].includes('いまの状況を整理します。'), false);
  assert.match(replies[3], /期限|最優先/);
  assert.equal(replies[5].includes('いまの状況を整理します。'), false);
  assert.match(replies[5], /SSN/);
  assert.match(replies[5], /必要書類|窓口/);
  assert.equal(replies[7].includes('いまの状況を整理します。'), false);
  assert.match(replies[7], /対象地域|受付期限|公式窓口/);
});
