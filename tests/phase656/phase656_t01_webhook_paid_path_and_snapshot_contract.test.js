'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const { test } = require('node:test');

const SECRET = 'phase656_line_secret';

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
  const usageCalls = [];
  const auditCalls = [];
  const counters = {
    faq: 0,
    assistant: 0
  };
  const snapshotResult = payload.snapshotResult || { ok: true, stale: false, snapshot: { phase: 'pre' } };

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
    appendAuditLog: async (entry) => {
      auditCalls.push(entry);
    }
  });
  setOverride('../../src/usecases/billing/planGate', {
    resolvePlan: async () => ({ plan: 'pro', status: 'active' })
  });
  setOverride('../../src/usecases/billing/evaluateLlmBudget', {
    evaluateLLMBudget: async () => ({
      allowed: true,
      policy: { model: 'gpt-4o-mini' }
    })
  });
  setOverride('../../src/usecases/assistant/recordLlmUsage', {
    recordLlmUsage: async (entry) => {
      usageCalls.push(entry);
      return { costEstimate: 0 };
    }
  });
  setOverride('../../src/usecases/assistant/llmAvailabilityGate', {
    evaluateLlmAvailability: async () => ({ available: true })
  });
  setOverride('../../src/usecases/context/getUserContextSnapshot', {
    getUserContextSnapshot: async () => snapshotResult
  });
  setOverride('../../src/usecases/assistant/generateFreeRetrievalReply', {
    generateFreeRetrievalReply: async () => ({
      replyText: 'FREE FALLBACK',
      sources: ['kb_fallback_1']
    })
  });
  setOverride('../../src/usecases/assistant/generatePaidAssistantReply', {
    detectExplicitPaidIntent: () => 'situation_analysis',
    classifyPaidIntent: () => 'situation_analysis',
    generatePaidAssistantReply: async () => {
      counters.assistant += 1;
      return {
        ok: true,
        replyText: 'PAID ASSISTANT PATH',
        tokensIn: 20,
        tokensOut: 30,
        model: 'gpt-4o-mini',
        output: {
          nextActions: [],
          evidenceKeys: ['kb_1'],
          situation: 'summary'
        }
      };
    }
  });
  setOverride('../../src/usecases/assistant/generatePaidFaqReply', {
    generatePaidFaqReply: async () => {
      counters.faq += 1;
      return {
        ok: true,
        replyText: 'PAID FAQ PATH',
        tokensIn: 12,
        tokensOut: 18,
        model: 'gpt-4o-mini',
        output: {
          nextActions: [],
          evidenceKeys: ['kb_1'],
          situation: 'summary'
        }
      };
    }
  });
  setOverride('../../src/usecases/journey/handleJourneyLineCommand', {
    handleJourneyLineCommand: async () => ({ handled: false })
  });
  setOverride('../../src/usecases/journey/handleJourneyPostback', {
    handleJourneyPostback: async () => ({ handled: false })
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
    usageCalls,
    auditCalls,
    counters,
    restore
  };
}

function webhookPayload() {
  return {
    events: [
      {
        type: 'message',
        replyToken: 'rt_phase656',
        source: { userId: 'U_PHASE656' },
        message: { type: 'text', text: '状況を整理して次の行動を知りたいです' }
      }
    ]
  };
}

test('phase656: webhook pro path switches between paid FAQ and paid assistant by ENABLE_PAID_FAQ_QUALITY_V2', async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: SECRET,
    ENABLE_SNAPSHOT_ONLY_CONTEXT_V1: '0',
    ENABLE_PAID_FAQ_QUALITY_V2: '1'
  });
  const loaded = loadWebhookWithStubs({
    snapshotResult: { ok: true, stale: false, snapshot: { phase: 'pre' } }
  });
  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const payload1 = webhookPayload();
  const body1 = JSON.stringify(payload1);
  const replies1 = [];
  const res1 = await loaded.handleLineWebhook({
    body: body1,
    signature: signBody(body1),
    requestId: 'phase656_req_paid_faq',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies1.push(message);
    }
  });

  assert.equal(res1.status, 200);
  assert.equal(replies1.length, 1);
  assert.equal(replies1[0].text, 'PAID FAQ PATH');
  assert.equal(loaded.counters.faq, 1);
  assert.equal(loaded.counters.assistant, 0);

  process.env.ENABLE_PAID_FAQ_QUALITY_V2 = '0';
  const payload2 = webhookPayload();
  const body2 = JSON.stringify(payload2);
  const replies2 = [];
  const res2 = await loaded.handleLineWebhook({
    body: body2,
    signature: signBody(body2),
    requestId: 'phase656_req_paid_assistant',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies2.push(message);
    }
  });

  assert.equal(res2.status, 200);
  assert.equal(replies2.length, 1);
  assert.equal(replies2[0].text, 'PAID ASSISTANT PATH');
  assert.equal(loaded.counters.faq, 1);
  assert.equal(loaded.counters.assistant, 1);

  const allowAudit = loaded.auditCalls.find((entry) => entry && entry.action === 'llm_gate.decision' && entry.payloadSummary && entry.payloadSummary.decision === 'allow');
  assert.ok(allowAudit, 'llm_gate.decision allow audit should be recorded');
});

test('phase656: snapshot strict mode blocks paid generation and falls back to free retrieval', async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: SECRET,
    ENABLE_SNAPSHOT_ONLY_CONTEXT_V1: '1',
    ENABLE_PAID_FAQ_QUALITY_V2: '1'
  });
  const loaded = loadWebhookWithStubs({
    snapshotResult: { ok: true, stale: true, snapshot: { phase: 'pre' } }
  });
  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const payload = webhookPayload();
  const body = JSON.stringify(payload);
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase656_req_snapshot_stale',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].text, 'FREE FALLBACK');
  assert.equal(loaded.counters.faq, 0);
  assert.equal(loaded.counters.assistant, 0);

  assert.ok(loaded.usageCalls.some((entry) => entry && entry.blockedReason === 'snapshot_stale'), 'snapshot_stale should be recorded in usage logs');
  const blockedAudit = loaded.auditCalls.find((entry) => entry && entry.action === 'llm_gate.decision' && entry.payloadSummary && entry.payloadSummary.blockedReason === 'snapshot_stale');
  assert.ok(blockedAudit, 'snapshot_stale should be recorded in llm_gate.decision audit');
});
