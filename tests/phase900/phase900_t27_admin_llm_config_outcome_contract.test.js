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

function makeReq(overrides) {
  return Object.assign({
    headers: {
      'x-actor': 'tester',
      'x-trace-id': 'trace_phase900_t27',
      'x-request-id': 'req_phase900_t27'
    }
  }, overrides || {});
}

test('phase900: llm config status success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/llmConfig');
  const flagsPath = require.resolve('../../src/repos/firestore/systemFlagsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const featureFlagPath = require.resolve('../../src/llm/featureFlag');
  const runtimePath = require.resolve('../../src/infra/llm/runtimeState');

  await withModuleStubs({
    [flagsPath]: {
      getLlmEnabled: async () => true,
      getLlmConciergeEnabled: async () => true,
      getLlmWebSearchEnabled: async () => false,
      getLlmStyleEngineEnabled: async () => true,
      getLlmBanditEnabled: async () => false,
      getLlmPolicy: async () => ({ lawfulBasis: 'consent', consentVerified: true, crossBorder: false }),
      normalizeLlmPolicy: (value) => value
    },
    [auditPath]: {
      appendAuditLog: async () => ({ id: 'audit_phase900_t27_status' })
    },
    [featureFlagPath]: {
      isLlmFeatureEnabled: () => true
    },
    [runtimePath]: {
      getLlmRuntimeState: ({ envFlag, systemFlag }) => ({ envFlag, systemFlag, effectiveEnabled: true, blockingReason: null })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleStatus } = require('../../src/routes/admin/llmConfig');
    const res = createResCapture();
    await handleStatus(makeReq(), res);
    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.llm_config_status');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    delete require.cache[routePath];
  });
});

test('phase900: llm config plan invalid input emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/llmConfig');
  const flagsPath = require.resolve('../../src/repos/firestore/systemFlagsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [flagsPath]: {
      getLlmPolicy: async () => ({ lawfulBasis: 'unspecified', consentVerified: false, crossBorder: false }),
      getLlmConciergeEnabled: async () => false,
      getLlmWebSearchEnabled: async () => false,
      getLlmStyleEngineEnabled: async () => false,
      getLlmBanditEnabled: async () => false,
      normalizeLlmPolicy: (value) => value
    },
    [auditPath]: {
      appendAuditLog: async () => ({ id: 'audit_phase900_t27_plan' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handlePlan } = require('../../src/routes/admin/llmConfig');
    const res = createResCapture();
    await handlePlan(makeReq(), res, JSON.stringify({ llmEnabled: 'maybe' }));
    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'llmenabled_required');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.llm_config_plan');
    delete require.cache[routePath];
  });
});

test('phase900: llm config set plan hash mismatch emits blocked outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/llmConfig');
  const flagsPath = require.resolve('../../src/repos/firestore/systemFlagsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [flagsPath]: {
      getLlmPolicy: async () => ({ lawfulBasis: 'unspecified', consentVerified: false, crossBorder: false }),
      getLlmConciergeEnabled: async () => false,
      getLlmWebSearchEnabled: async () => false,
      getLlmStyleEngineEnabled: async () => false,
      getLlmBanditEnabled: async () => false,
      setLlmEnabled: async () => ({}),
      setLlmConciergeEnabled: async () => ({}),
      setLlmWebSearchEnabled: async () => ({}),
      setLlmStyleEngineEnabled: async () => ({}),
      setLlmBanditEnabled: async () => ({}),
      setLlmPolicy: async () => ({}),
      normalizeLlmPolicy: (value) => value
    },
    [auditPath]: {
      appendAuditLog: async () => ({ id: 'audit_phase900_t27_set_mismatch' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleSet } = require('../../src/routes/admin/llmConfig');
    const res = createResCapture();
    await handleSet(makeReq(), res, JSON.stringify({
      llmEnabled: true,
      planHash: 'wrong',
      confirmToken: 'token'
    }));
    const body = res.readJson();
    assert.equal(res.result.statusCode, 409);
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'plan_hash_mismatch');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.llm_config_set');
    delete require.cache[routePath];
  });
});
