'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function createResCapture() {
  const stagedHeaders = {};
  const result = { statusCode: null, headers: null, body: '' };
  return {
    setHeader(name, value) {
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

function withModuleStubs(stubMap, callback) {
  const previous = new Map();
  Object.entries(stubMap || {}).forEach(([modulePath, exports]) => {
    previous.set(modulePath, require.cache[modulePath]);
    require.cache[modulePath] = {
      id: modulePath,
      filename: modulePath,
      loaded: true,
      exports
    };
  });
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      previous.forEach((entry, modulePath) => {
        if (entry) require.cache[modulePath] = entry;
        else delete require.cache[modulePath];
      });
    });
}

test('phase900: admin llm faq blocked response emits blocked outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/llmFaq');
  const answerPath = require.resolve('../../src/usecases/faq/answerFaqFromKb');
  const gatePath = require.resolve('../../src/usecases/llm/appendLlmGateDecision');

  await withModuleStubs({
    [answerPath]: {
      answerFaqFromKb: async () => ({
        ok: false,
        blocked: true,
        blockedReason: 'llm_disabled',
        httpStatus: 422,
        traceId: 'trace_phase900_t26_blocked'
      })
    },
    [gatePath]: {
      appendLlmGateDecision: async () => ({ id: 'gate_phase900_t26_blocked' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleAdminLlmFaqAnswer } = require('../../src/routes/admin/llmFaq');
    const res = createResCapture();

    await handleAdminLlmFaqAnswer({
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t26_blocked', 'x-request-id': 'req_phase900_t26_blocked' }
    }, res, JSON.stringify({ question: '会員番号の確認方法は？', locale: 'ja' }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 422);
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'llm_disabled');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.llm_faq_answer');
    assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
    delete require.cache[routePath];
  });
});

test('phase900: admin llm faq success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/llmFaq');
  const answerPath = require.resolve('../../src/usecases/faq/answerFaqFromKb');
  const gatePath = require.resolve('../../src/usecases/llm/appendLlmGateDecision');

  await withModuleStubs({
    [answerPath]: {
      answerFaqFromKb: async () => ({
        ok: true,
        httpStatus: 200,
        faqAnswer: { answer: '確認できます。' },
        llmStatus: 'ok'
      })
    },
    [gatePath]: {
      appendLlmGateDecision: async () => ({ id: 'gate_phase900_t26_success' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleAdminLlmFaqAnswer } = require('../../src/routes/admin/llmFaq');
    const res = createResCapture();

    await handleAdminLlmFaqAnswer({
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t26_success', 'x-request-id': 'req_phase900_t26_success' }
    }, res, JSON.stringify({ question: '会員番号の確認方法は？', locale: 'ja' }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.llm_faq_answer');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    delete require.cache[routePath];
  });
});

test('phase900: admin llm faq invalid request emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/llmFaq');
  const answerPath = require.resolve('../../src/usecases/faq/answerFaqFromKb');
  const gatePath = require.resolve('../../src/usecases/llm/appendLlmGateDecision');

  await withModuleStubs({
    [answerPath]: {
      answerFaqFromKb: async () => {
        throw new Error('question required');
      }
    },
    [gatePath]: {
      appendLlmGateDecision: async () => ({ id: 'gate_phase900_t26_invalid' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleAdminLlmFaqAnswer } = require('../../src/routes/admin/llmFaq');
    const res = createResCapture();

    await handleAdminLlmFaqAnswer({
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t26_invalid', 'x-request-id': 'req_phase900_t26_invalid' }
    }, res, JSON.stringify({ locale: 'ja' }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'question_required');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.llm_faq_answer');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    delete require.cache[routePath];
  });
});
