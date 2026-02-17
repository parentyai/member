'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('phase227 t02: /api/admin/llm/next-actions passes x-actor to usecase params', async () => {
  const usecasePath = require.resolve('../../src/usecases/phaseLLM3/getNextActionCandidates');
  const routePath = require.resolve('../../src/routes/admin/llmOps');

  const originalUsecase = require.cache[usecasePath];
  const originalRoute = require.cache[routePath];

  const seen = { params: null };

  require.cache[usecasePath] = {
    id: usecasePath,
    filename: usecasePath,
    loaded: true,
    exports: {
      getNextActionCandidates: async (params) => {
        seen.params = params;
        return { ok: true, stub: true };
      }
    }
  };
  delete require.cache[routePath];

  const { handleAdminLlmNextActions } = require('../../src/routes/admin/llmOps');

  const req = {
    url: '/api/admin/llm/next-actions?lineUserId=U1',
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
    await handleAdminLlmNextActions(req, res);
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

