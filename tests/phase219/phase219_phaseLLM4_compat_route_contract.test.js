'use strict';

const assert = require('assert');
const { test } = require('node:test');

const USECASE_PATH = require.resolve('../../src/usecases/faq/answerFaqFromKb');
const ROUTE_PATH = require.resolve('../../src/routes/phaseLLM4FaqAnswer');

function createResCapture() {
  const out = {
    status: null,
    headers: null,
    body: ''
  };
  return {
    out,
    res: {
      writeHead(status, headers) {
        out.status = status;
        out.headers = headers || {};
      },
      end(body) {
        out.body = typeof body === 'string' ? body : '';
      }
    }
  };
}

async function withMockedRoute(mockAnswerFaqFromKb, fn) {
  const prevUsecase = require.cache[USECASE_PATH];
  const prevRoute = require.cache[ROUTE_PATH];
  require.cache[USECASE_PATH] = {
    id: USECASE_PATH,
    filename: USECASE_PATH,
    loaded: true,
    exports: { answerFaqFromKb: mockAnswerFaqFromKb }
  };
  delete require.cache[ROUTE_PATH];
  const route = require('../../src/routes/phaseLLM4FaqAnswer');
  try {
    await fn(route);
  } finally {
    delete require.cache[ROUTE_PATH];
    if (prevUsecase) require.cache[USECASE_PATH] = prevUsecase;
    else delete require.cache[USECASE_PATH];
    if (prevRoute) require.cache[ROUTE_PATH] = prevRoute;
  }
}

test('phase219: phaseLLM4 compat route appends deprecated metadata on blocked response', async () => {
  let capturedParams = null;
  await withMockedRoute(async (params) => {
    capturedParams = params;
    return {
      ok: false,
      blocked: true,
      httpStatus: 422,
      blockedReason: 'llm_disabled',
      traceId: params.traceId || null
    };
  }, async ({ handleFaqAnswer }) => {
    const { out, res } = createResCapture();
    const req = {
      headers: {
        'x-trace-id': 'TRACE_219_A',
        'x-request-id': 'REQ_219_A'
      }
    };

    await handleFaqAnswer(req, res, JSON.stringify({ question: 'Q', locale: 'ja' }));

    assert.strictEqual(out.status, 422);
    const payload = JSON.parse(out.body);
    assert.strictEqual(payload.ok, false);
    assert.strictEqual(payload.blockedReason, 'llm_disabled');
    assert.strictEqual(payload.deprecated, true);
    assert.strictEqual(payload.replacement, '/api/admin/llm/faq/answer');

    assert.ok(capturedParams);
    assert.strictEqual(capturedParams.traceId, 'TRACE_219_A');
    assert.strictEqual(capturedParams.requestId, 'REQ_219_A');
    assert.strictEqual(capturedParams.actor, 'phaseLLM4_faq_compat');
  });
});

test('phase219: phaseLLM4 compat route returns 400 on required/invalid parse errors', async () => {
  await withMockedRoute(async () => {
    throw new Error('question required');
  }, async ({ handleFaqAnswer }) => {
    const { out, res } = createResCapture();
    const req = { headers: {} };

    await handleFaqAnswer(req, res, JSON.stringify({ locale: 'ja' }));

    assert.strictEqual(out.status, 400);
    const payload = JSON.parse(out.body);
    assert.strictEqual(payload.ok, false);
    assert.strictEqual(payload.error, 'question required');
    assert.ok(!Object.prototype.hasOwnProperty.call(payload, 'deprecated'));
  });
});
