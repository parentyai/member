'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const SECRET = 'phase654_line_secret';

function signBody(body) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('base64');
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

function loadWebhookWithStubs(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const planInfo = payload.planInfo || { plan: 'free', status: 'unknown' };
  const taskNodes = Array.isArray(payload.taskNodes) ? payload.taskNodes : [];

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
    replyMessage: async () => ({ status: 200 })
  });
  setOverride('../../src/usecases/cityPack/declareCityRegionFromLine', {
    declareCityRegionFromLine: async () => ({ status: 'none' })
  });
  setOverride('../../src/usecases/cityPack/declareCityPackFeedbackFromLine', {
    declareCityPackFeedbackFromLine: async () => ({ status: 'none' })
  });
  setOverride('../../src/usecases/llm/recordUserLlmConsent', {
    recordUserLlmConsent: async () => ({ ok: true })
  });
  setOverride('../../src/repos/firestore/eventsRepo', {
    createEvent: async () => ({ ok: true })
  });
  setOverride('../../src/usecases/audit/appendAuditLog', {
    appendAuditLog: async () => ({ ok: true })
  });
  setOverride('../../src/usecases/billing/planGate', {
    resolvePlan: async () => planInfo
  });
  setOverride('../../src/usecases/billing/evaluateLlmBudget', {
    evaluateLLMBudget: async () => ({
      allowed: true,
      intent: 'next_action_generation',
      policy: { model: 'gpt-4o-mini' }
    })
  });
  setOverride('../../src/usecases/assistant/recordLlmUsage', {
    recordLlmUsage: async () => ({ costEstimate: 0 })
  });
  setOverride('../../src/usecases/assistant/llmAvailabilityGate', {
    evaluateLlmAvailability: async () => ({ available: true })
  });
  setOverride('../../src/usecases/context/getUserContextSnapshot', {
    getUserContextSnapshot: async () => ({ ok: true, stale: false, snapshot: { phase: 'pre' } })
  });
  setOverride('../../src/usecases/assistant/generateFreeRetrievalReply', {
    generateFreeRetrievalReply: async () => ({ ok: true, replyText: 'FREE RETRIEVAL', citations: ['kb_1'] })
  });
  setOverride('../../src/usecases/assistant/generatePaidAssistantReply', {
    detectExplicitPaidIntent: () => null,
    classifyPaidIntent: () => 'next_action_generation',
    generatePaidAssistantReply: async () => ({
      ok: true,
      replyText: 'PAID ASSISTANT',
      output: { nextActions: [], evidenceKeys: ['kb_1'], situation: 'summary' },
      tokensIn: 10,
      tokensOut: 20,
      model: 'gpt-4o-mini'
    })
  });
  setOverride('../../src/usecases/assistant/generatePaidFaqReply', {
    generatePaidFaqReply: async () => ({
      ok: true,
      replyText: 'PAID FAQ',
      output: { nextActions: ['書類を確認'], evidenceKeys: ['kb_1'], situation: 'summary' },
      tokensIn: 10,
      tokensOut: 20,
      model: 'gpt-4o-mini'
    })
  });
  setOverride('../../src/usecases/journey/handleJourneyLineCommand', {
    handleJourneyLineCommand: async () => ({ handled: false })
  });
  setOverride('../../src/usecases/journey/handleJourneyPostback', {
    handleJourneyPostback: async () => ({ handled: false })
  });
  setOverride('../../src/repos/firestore/taskNodesRepo', {
    listTaskNodesByLineUserId: async () => taskNodes
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
    restore
  };
}

function createWebhookBody(text) {
  return JSON.stringify({
    events: [
      {
        type: 'message',
        replyToken: 'rt_phase654',
        source: { userId: 'U_PHASE654_WEBHOOK' },
        message: { type: 'text', text }
      }
    ]
  });
}

test('phase654: free plan appends simplified dependency lock reason when task graph is enabled', async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: SECRET,
    ENABLE_TASK_GRAPH_V1: '1',
    ENABLE_PRO_PREDICTIVE_ACTIONS_V1: '0'
  });
  const loaded = loadWebhookWithStubs({
    planInfo: { plan: 'free', status: 'none' },
    taskNodes: [
      {
        todoKey: 'housing_setup',
        status: 'locked',
        graphStatus: 'locked',
        lockReasons: ['依存未完了:visa_documents'],
        riskScore: 120
      }
    ]
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('依存ロック中のタスクを教えて');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase654_req_free_graph',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].text.includes('FREE RETRIEVAL'));
  assert.ok(replies[0].text.includes('依存ロック中タスク: 1件'));
  assert.ok(replies[0].text.includes('ロック理由: 依存未完了:visa_documents'));
});

test('phase654: pro plan appends dependency addendum with actionable top3 when predictive actions are enabled', async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: SECRET,
    ENABLE_TASK_GRAPH_V1: '1',
    ENABLE_PRO_PREDICTIVE_ACTIONS_V1: '1',
    ENABLE_PAID_FAQ_QUALITY_V2: '1'
  });
  const loaded = loadWebhookWithStubs({
    planInfo: { plan: 'pro', status: 'active' },
    taskNodes: [
      {
        todoKey: 'housing_setup',
        title: '住居準備',
        status: 'locked',
        graphStatus: 'locked',
        lockReasons: ['依存未完了:visa_documents'],
        riskScore: 120
      },
      {
        todoKey: 'bank_opening',
        title: '銀行口座開設',
        status: 'not_started',
        graphStatus: 'actionable',
        dueAt: '2026-03-03T00:00:00.000Z',
        dueDate: '2026-03-03',
        riskScore: 90
      },
      {
        todoKey: 'school_registration',
        title: '学校手続き',
        status: 'in_progress',
        graphStatus: 'actionable',
        dueAt: '2026-03-05T00:00:00.000Z',
        dueDate: '2026-03-05',
        riskScore: 80
      },
      {
        todoKey: 'insurance_plan',
        title: '保険見直し',
        status: 'not_started',
        graphStatus: 'actionable',
        dueAt: '2026-03-08T00:00:00.000Z',
        dueDate: '2026-03-08',
        riskScore: 70
      }
    ]
  });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('次の行動を整理して');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase654_req_pro_graph',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].text.includes('PAID FAQ'));
  assert.ok(replies[0].text.includes('補足（依存グラフ）'));
  assert.ok(replies[0].text.includes('ロック中: 1件'));
  assert.ok(replies[0].text.includes('次アクション候補(最大3):'));
});
