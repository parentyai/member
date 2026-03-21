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

test('phase900: managed flow guard permits missing trace when traceMode is optional', async () => {
  const actionKey = 'managed_flow.trace_optional.execute';
  const flow = {
    flowId: 'flow_trace_optional',
    confirmMode: 'required',
    guardRules: {
      actorMode: 'required',
      traceMode: 'optional',
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
        url: '/api/admin/custom/trace-optional',
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
        planHash: 'plan_phase900_t87',
        confirmToken: 'confirm_phase900_t87'
      }
    }, {
      appendAuditLog: async (entry) => {
        audits.push(entry);
      }
    });

    assert.ok(result && result.ok === true);
    assert.equal(result.traceId, null);
    assert.equal(result.actor, 'phase900_actor');
    assert.equal(result.confirmMode, 'required');

    const reasons = audits
      .filter((entry) => entry && entry.payloadSummary && entry.payloadSummary.reason)
      .map((entry) => entry.payloadSummary.reason);
    assert.ok(!reasons.includes('trace_required'));
    assert.ok(!reasons.includes('trace_fallback'));
  } finally {
    restore();
  }
});
