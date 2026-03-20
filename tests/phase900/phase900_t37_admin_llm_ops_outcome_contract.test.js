'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function createResCapture() {
  const stagedHeaders = {};
  const result = { statusCode: null, headers: null, body: '' };
  return {
    setHeader(name, value) {
      if (!name) return;
      stagedHeaders[String(name).toLowerCase()] = value;
    },
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      const normalized = {};
      Object.keys(headers || {}).forEach((key) => {
        normalized[String(key).toLowerCase()] = headers[key];
      });
      result.headers = Object.assign({}, stagedHeaders, normalized);
    },
    end(chunk) {
      if (chunk) result.body += String(chunk);
    },
    readJson() {
      return JSON.parse(result.body || '{}');
    },
    result
  };
}

async function withLlmOpsHandlers(stubs, run) {
  const opsUsecasePath = require.resolve('../../src/usecases/phaseLLM2/getOpsExplanation');
  const nextUsecasePath = require.resolve('../../src/usecases/phaseLLM3/getNextActionCandidates');
  const routePath = require.resolve('../../src/routes/admin/llmOps');
  const originalOpsUsecase = require.cache[opsUsecasePath];
  const originalNextUsecase = require.cache[nextUsecasePath];
  const originalRoute = require.cache[routePath];

  require.cache[opsUsecasePath] = {
    id: opsUsecasePath,
    filename: opsUsecasePath,
    loaded: true,
    exports: {
      getOpsExplanation: stubs && typeof stubs.getOpsExplanation === 'function'
        ? stubs.getOpsExplanation
        : async () => ({ ok: true, llmUsed: true, llmStatus: 'ok', explanation: { opsExplanation: 'ok' } })
    }
  };
  require.cache[nextUsecasePath] = {
    id: nextUsecasePath,
    filename: nextUsecasePath,
    loaded: true,
    exports: {
      getNextActionCandidates: stubs && typeof stubs.getNextActionCandidates === 'function'
        ? stubs.getNextActionCandidates
        : async () => ({ ok: true, llmUsed: true, llmStatus: 'ok', nextActionCandidates: { candidates: [] } })
    }
  };
  delete require.cache[routePath];

  try {
    const handlers = require('../../src/routes/admin/llmOps');
    await run(handlers);
  } finally {
    if (originalOpsUsecase) require.cache[opsUsecasePath] = originalOpsUsecase;
    else delete require.cache[opsUsecasePath];
    if (originalNextUsecase) require.cache[nextUsecasePath] = originalNextUsecase;
    else delete require.cache[nextUsecasePath];
    if (originalRoute) require.cache[routePath] = originalRoute;
    else delete require.cache[routePath];
  }
}

test('phase900: llm ops-explain missing lineUserId emits normalized error outcome metadata', async () => {
  await withLlmOpsHandlers({}, async ({ handleAdminLlmOpsExplain }) => {
    const res = createResCapture();
    await handleAdminLlmOpsExplain({
      url: '/api/admin/llm/ops-explain',
      headers: { 'x-actor': 'phase900_actor', 'x-trace-id': 'trace_phase900_llm_ops_missing' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'lineUserId required');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'line_user_id_required');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.llm_ops_explain');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'line_user_id_required');
  });
});

test('phase900: llm ops-explain success emits completed outcome metadata', async () => {
  await withLlmOpsHandlers({
    getOpsExplanation: async () => ({
      ok: true,
      llmUsed: true,
      llmStatus: 'ok',
      llmModel: 'test-model',
      explanation: { opsExplanation: 'hello' }
    })
  }, async ({ handleAdminLlmOpsExplain }) => {
    const res = createResCapture();
    await handleAdminLlmOpsExplain({
      url: '/api/admin/llm/ops-explain?lineUserId=U_phase900',
      headers: { 'x-actor': 'phase900_actor', 'x-trace-id': 'trace_phase900_llm_ops_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.llm_ops_explain');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  });
});

test('phase900: llm next-actions fallback emits blocked outcome metadata', async () => {
  await withLlmOpsHandlers({
    getNextActionCandidates: async () => ({
      ok: true,
      llmUsed: false,
      llmStatus: 'ops_blocked',
      nextActionCandidates: { candidates: [] }
    })
  }, async ({ handleAdminLlmNextActions }) => {
    const res = createResCapture();
    await handleAdminLlmNextActions({
      url: '/api/admin/llm/next-actions?lineUserId=U_phase900',
      headers: { 'x-actor': 'phase900_actor', 'x-trace-id': 'trace_phase900_llm_next_blocked' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'ops_blocked');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.llm_next_actions');
    assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'ops_blocked');
  });
});

test('phase900: llm ops-explain missing actor emits normalized error outcome metadata', async () => {
  await withLlmOpsHandlers({}, async ({ handleAdminLlmOpsExplain }) => {
    const res = createResCapture();
    await handleAdminLlmOpsExplain({
      url: '/api/admin/llm/ops-explain?lineUserId=U_phase900',
      headers: { 'x-trace-id': 'trace_phase900_llm_ops_actor_missing' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'x-actor required');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'x_actor_required');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'x_actor_required');
  });
});
