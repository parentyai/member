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

test('phase900: managed flow guard with allow_fallback emits only actor_fallback warning when trace already exists', async () => {
  const actionKey = 'managed_flow.allow_fallback.warning_split';
  const flow = {
    flowId: 'flow_allow_fallback_warning_split',
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
        url: '/api/admin/custom/allow-fallback-warning-split',
        headers: {
          'x-trace-id': 'trace_phase900_warning_split'
        }
      },
      res: {
        writeHead() {},
        end() {}
      },
      actionKey,
      payload: {
        planHash: 'plan_phase900_warning_split',
        confirmToken: 'confirm_phase900_warning_split'
      }
    }, {
      appendAuditLog: async (entry) => {
        audits.push(entry);
      }
    });

    assert.ok(result && result.ok === true);
    assert.equal(result.actor, 'unknown');
    assert.equal(result.traceId, 'trace_phase900_warning_split');

    const warningReasons = audits
      .filter((entry) => entry && entry.action === 'managed_flow.guard.warning')
      .map((entry) => entry && entry.payloadSummary && entry.payloadSummary.reason);
    assert.ok(warningReasons.includes('actor_fallback'));
    assert.ok(!warningReasons.includes('trace_fallback'));
  } finally {
    restore();
  }
});
