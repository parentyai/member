'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function createResCapture() {
  const result = { statusCode: null, body: '' };
  return {
    writeHead(statusCode) {
      result.statusCode = statusCode;
    },
    end(chunk) {
      if (chunk) result.body += String(chunk);
    },
    result
  };
}

function loadGuardWithStubs(registry, resolvedActionKey) {
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

test('phase900: managed flow guard allow_fallback flow emits warnings and returns fallback actor/trace', async () => {
  const actionKey = 'managed_flow.fallback.execute';
  const flow = {
    flowId: 'flow_allow_fallback',
    confirmMode: 'warn_only',
    guardRules: {
      actorMode: 'allow_fallback',
      traceMode: 'required',
      confirmMode: 'optional',
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
  const { guardModule, restore } = loadGuardWithStubs(registry, actionKey);

  try {
    const audits = [];
    const res = createResCapture();
    const result = await guardModule.enforceManagedFlowGuard({
      req: {
        method: 'POST',
        url: '/api/admin/custom/fallback/',
        headers: {
          'x-request-id': 'trace_phase900_guard_fallback_request'
        }
      },
      res,
      actionKey,
      payload: {}
    }, {
      appendAuditLog: async (entry) => {
        audits.push(entry);
      }
    });

    assert.ok(result && result.ok === true);
    assert.equal(result.actionKey, actionKey);
    assert.equal(result.actor, 'unknown');
    assert.equal(result.traceId, 'trace_phase900_guard_fallback_request');
    assert.equal(res.result.statusCode, null);

    const warningReasons = audits
      .filter((entry) => entry && entry.action === 'managed_flow.guard.warning')
      .map((entry) => entry && entry.payloadSummary && entry.payloadSummary.reason);
    assert.ok(warningReasons.includes('trace_fallback'));
    assert.ok(warningReasons.includes('actor_fallback'));
  } finally {
    restore();
  }
});
