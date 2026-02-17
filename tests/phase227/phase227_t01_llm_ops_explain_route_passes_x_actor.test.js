'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('phase227 t01: /api/admin/llm/ops-explain passes x-actor to usecase params', async () => {
  const usecasePath = require.resolve('../../src/usecases/phaseLLM2/getOpsExplanation');
  const routePath = require.resolve('../../src/routes/admin/llmOps');

  const originalUsecase = require.cache[usecasePath];
  const originalRoute = require.cache[routePath];

  const seen = { params: null };

  require.cache[usecasePath] = {
    id: usecasePath,
    filename: usecasePath,
    loaded: true,
    exports: {
      getOpsExplanation: async (params) => {
        seen.params = params;
        return { ok: true, stub: true };
      }
    }
  };
  delete require.cache[routePath];

  const { handleAdminLlmOpsExplain } = require('../../src/routes/admin/llmOps');

  const req = {
    url: '/api/admin/llm/ops-explain?lineUserId=U1',
    headers: {
      'x-actor': 'alice',
      'x-trace-id': 't1'
    }
  };

  let status = null;
  let body = null;
  const res = {
    writeHead: (code) => {
      status = code;
    },
    end: (text) => {
      body = text;
    }
  };

  try {
    await handleAdminLlmOpsExplain(req, res);
  } finally {
    if (originalUsecase) require.cache[usecasePath] = originalUsecase;
    else delete require.cache[usecasePath];
    if (originalRoute) require.cache[routePath] = originalRoute;
    else delete require.cache[routePath];
  }

  assert.equal(status, 200);
  assert.equal(JSON.parse(body).ok, true);
  assert.equal(seen.params.lineUserId, 'U1');
  assert.equal(seen.params.traceId, 't1');
  assert.equal(seen.params.actor, 'alice');
});

