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

function loadGuardWithRegistry(registry) {
  const registryPath = require.resolve('../../src/domain/managedFlowRegistry');
  const bindingsPath = require.resolve('../../src/routes/admin/managedFlowBindings');
  const guardPath = require.resolve('../../src/routes/admin/managedFlowGuard');
  const originalRegistry = require.cache[registryPath];
  const originalBindings = require.cache[bindingsPath];
  const originalGuard = require.cache[guardPath];

  require.cache[registryPath] = {
    id: registryPath,
    filename: registryPath,
    loaded: true,
    exports: {
      getManagedFlowRegistry: () => registry
    }
  };
  require.cache[bindingsPath] = {
    id: bindingsPath,
    filename: bindingsPath,
    loaded: true,
    exports: {
      resolveActionByMethodAndPath: () => null
    }
  };
  delete require.cache[guardPath];

  const guardModule = require('../../src/routes/admin/managedFlowGuard');
  return {
    guardModule,
    restore() {
      if (originalRegistry) require.cache[registryPath] = originalRegistry;
      else delete require.cache[registryPath];
      if (originalBindings) require.cache[bindingsPath] = originalBindings;
      else delete require.cache[bindingsPath];
      if (originalGuard) require.cache[guardPath] = originalGuard;
      else delete require.cache[guardPath];
    }
  };
}

test('phase900: managed flow guard normalizes routeKey/routeType defaults in error outcomes', async () => {
  const registry = { actionByKey: {}, flowById: {} };
  const { guardModule, restore } = loadGuardWithRegistry(registry);
  try {
    const res = createResCapture();
    const result = await guardModule.enforceManagedFlowGuard({
      req: {
        method: 'POST',
        url: '/api/admin/custom/route-key-normalization',
        headers: {
          'x-trace-id': 'trace_phase900_route_key',
          'x-actor': 'phase900_actor'
        }
      },
      res,
      actionKey: '  flow bad/key?x  ',
      payload: {}
    });

    const body = res.readJson();
    assert.equal(result, null);
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.error, 'managed_flow_action_not_defined');
    assert.equal(body.outcome && body.outcome.routeType, 'admin_route');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.decision, 'block');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.flow_bad_key_x');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'managed_flow_action_not_defined');
  } finally {
    restore();
  }
});
