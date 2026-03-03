'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const SECRET = 'phase716_line_secret';

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
  const auditCalls = [];
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
  setOverride('../../src/repos/firestore/systemFlagsRepo', {
    getPublicWriteSafetySnapshot: async () => ({
      killSwitchOn: false,
      failCloseMode: 'warn',
      trackAuditWriteMode: 'best_effort',
      readError: false,
      source: 'test'
    }),
    getLlmConciergeEnabled: async () => payload.llmConciergeEnabled === true
  });
  setOverride('../../src/usecases/billing/planGate', {
    resolvePlan: async () => ({ plan: 'free', status: 'none' })
  });
  setOverride('../../src/usecases/billing/evaluateLlmBudget', {
    evaluateLLMBudget: async () => ({ allowed: false, blockedReason: 'free_retrieval_only', policy: null })
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
    generateFreeRetrievalReply: async () => ({
      ok: true,
      mode: 'ranked',
      replyText: 'FREE RETRIEVAL BASE',
      citations: ['kb_1'],
      faqCandidates: [],
      cityPackCandidates: []
    })
  });
  setOverride('../../src/usecases/assistant/concierge/composeConciergeReply', {
    composeConciergeReply: async () => {
      composeCalled += 1;
      return {
        ok: true,
        replyText: 'FREE RETRIEVAL BASE\n\n(source: uscis.gov/forms)',
        auditMeta: {
          topic: 'visa',
          mode: 'B',
          userTier: 'free',
          citationRanks: ['R0'],
          urlCount: 1,
          urls: [{ rank: 'R0', domain: 'uscis.gov', path: '/forms', allowed: true, reason: 'accepted', source: 'stored' }],
          guardDecisions: [{ rank: 'R0', domain: 'uscis.gov', path: '/forms', allowed: true, reason: 'accepted', source: 'stored' }],
          blockedReasons: [],
          injectionFindings: false
        }
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
  setOverride('../../src/usecases/assistant/generatePaidAssistantReply', {
    detectExplicitPaidIntent: () => null,
    classifyPaidIntent: () => 'faq_search',
    generatePaidAssistantReply: async () => ({ ok: false, blockedReason: 'unused' })
  });
  setOverride('../../src/usecases/assistant/generatePaidFaqReply', {
    generatePaidFaqReply: async () => ({ ok: false, blockedReason: 'unused' })
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
    getComposeCalled: () => composeCalled,
    restore
  };
}

function createWebhookBody(text) {
  return JSON.stringify({
    events: [
      {
        type: 'message',
        replyToken: 'rt_phase716',
        source: { userId: 'U_PHASE716' },
        message: { type: 'text', text }
      }
    ]
  });
}

test('phase716: concierge enabled appends citation footer and audit meta keys', async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: SECRET
  });
  const loaded = loadWebhookWithStubs({ llmConciergeEnabled: true });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('visa update please');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase716_req_on',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].text.includes('(source: uscis.gov/forms)'));
  assert.equal(loaded.getComposeCalled(), 1);

  const gateAudit = loaded.auditCalls.find((entry) => entry && entry.action === 'llm_gate.decision');
  assert.ok(gateAudit, 'llm_gate.decision audit must exist');
  const summary = gateAudit.payloadSummary || {};
  assert.equal(summary.mode, 'B');
  assert.equal(summary.topic, 'visa');
  assert.equal(summary.userTier, 'free');
  assert.equal(summary.urlCount, 1);
  assert.ok(Array.isArray(summary.urls));
  assert.ok(Array.isArray(summary.guardDecisions));
  assert.ok(Array.isArray(summary.blockedReasons));
  assert.equal(typeof summary.injectionFindings, 'boolean');
});

test('phase716: concierge kill-switch OFF keeps retrieval fallback without compose', async (t) => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: SECRET
  });
  const loaded = loadWebhookWithStubs({ llmConciergeEnabled: false });

  t.after(() => {
    loaded.restore();
    restoreEnv();
  });

  const body = createWebhookBody('visa update please');
  const replies = [];
  const result = await loaded.handleLineWebhook({
    body,
    signature: signBody(body),
    requestId: 'phase716_req_off',
    logger: () => {},
    allowWelcome: false,
    replyFn: async (_replyToken, message) => {
      replies.push(message);
    }
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].text, 'FREE RETRIEVAL BASE');
  assert.equal(loaded.getComposeCalled(), 0);

  const gateAudit = loaded.auditCalls.find((entry) => entry && entry.action === 'llm_gate.decision');
  assert.ok(gateAudit, 'llm_gate.decision audit must exist');
  const summary = gateAudit.payloadSummary || {};
  assert.equal(summary.mode, null);
  assert.equal(summary.urlCount, 0);
  assert.deepEqual(summary.citationRanks, []);
});
