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

function loadGuardWithRegistry(registry, resolvedActionKey) {
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
      resolveActionByMethodAndPath: () => (resolvedActionKey ? { actionKey: resolvedActionKey } : null)
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

test('phase900: managed flow guard with allow_fallback emits both trace and actor fallbacks when x-trace-id and x-actor are whitespace', async () => {
  const actionKey = 'managed_flow.dual.whitespace_fallback';
  const flow = {
    flowId: 'flow_dual_whitespace_fallback',
    confirmMode: 'required',
    guardRules: {
      actorMode: 'allow_fallback',
      traceMode: 'required',
      confirmMode: 'required',
      killSwitchCheck: 'none',
      auditMode: 'required'
    }
  };
  const registry = {
    actionByKey: {
      [actionKey]: {
        actionKey,
        flowId: flow.flowId
      }
    },
    flowById: {
      [flow.flowId]: flow
    }
  };
  const { guardModule, restore } = loadGuardWithRegistry(registry, actionKey);
  try {
    const audits = [];
    const res = createResCapture();
    const result = await guardModule.enforceManagedFlowGuard({
      req: {
        method: 'POST',
        url: '/api/admin/custom/dual-whitespace-fallback',
        headers: {
          'x-trace-id': '   ',
          'x-request-id': 'req_phase900_t98',
          'x-actor': '   '
        }
      },
      res,
      actionKey,
      payload: {
        planHash: 'plan_phase900_t98',
        confirmToken: 'confirm_phase900_t98'
      }
    }, {
      appendAuditLog: async (entry) => {
        audits.push(entry);
      }
    });

    assert.equal(res.result.statusCode, null);
    assert.equal(result && result.ok, true);
    assert.equal(result.traceId, 'req_phase900_t98');
    assert.equal(result.actor, 'unknown');

    const warningPairs = audits
      .filter((entry) => entry && entry.action === 'managed_flow.guard.warning')
      .map((entry) => [entry.payloadSummary && entry.payloadSummary.reason, entry.traceId]);
    assert.deepEqual(warningPairs, [
      ['trace_fallback', 'req_phase900_t98'],
      ['actor_fallback', 'req_phase900_t98']
    ]);
  } finally {
    restore();
  }
});
