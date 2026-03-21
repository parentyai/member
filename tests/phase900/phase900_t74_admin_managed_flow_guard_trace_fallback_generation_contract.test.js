'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

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

test('phase900: managed flow guard generates fallback trace id when allow_fallback flow has no trace and request-id', async () => {
  const actionKey = 'managed_flow.trace_fallback.execute';
  const flow = {
    flowId: 'flow_trace_fallback',
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
    const result = await guardModule.enforceManagedFlowGuard({
      req: {
        method: 'POST',
        url: '/api/admin/custom/trace-fallback',
        headers: {
          'x-actor': 'phase900_actor'
        }
      },
      res: {
        writeHead() {},
        end() {}
      },
      actionKey,
      payload: {
        planHash: 'plan_phase900_trace_fallback',
        confirmToken: 'confirm_phase900_trace_fallback'
      }
    }, {
      appendAuditLog: async (entry) => {
        audits.push(entry);
      }
    });

    assert.ok(result && result.ok === true);
    assert.equal(result.actor, 'phase900_actor');
    assert.match(String(result.traceId), /^managed_flow_trace_\d+_\d+$/);

    const traceFallbackWarning = audits.find((entry) => {
      return entry && entry.action === 'managed_flow.guard.warning'
        && entry.payloadSummary && entry.payloadSummary.reason === 'trace_fallback';
    });
    assert.ok(traceFallbackWarning);
    assert.equal(traceFallbackWarning.actor, 'phase900_actor');
    assert.match(String(traceFallbackWarning.traceId), /^managed_flow_trace_\d+_\d+$/);
  } finally {
    restore();
  }
});
