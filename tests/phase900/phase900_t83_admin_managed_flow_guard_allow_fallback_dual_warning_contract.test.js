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

test('phase900: managed flow guard with allow_fallback emits trace_fallback and actor_fallback warnings when both trace and actor are missing', async () => {
  const actionKey = 'managed_flow.allow_fallback.dual_warning';
  const flow = {
    flowId: 'flow_allow_fallback_dual_warning',
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
        url: '/api/admin/custom/allow-fallback-dual-warning',
        headers: {
          'x-request-id': 'req_phase900_t83'
        }
      },
      res: {
        writeHead() {},
        end() {}
      },
      actionKey,
      payload: {
        planHash: 'plan_phase900_t83',
        confirmToken: 'confirm_phase900_t83'
      }
    }, {
      appendAuditLog: async (entry) => {
        audits.push(entry);
      }
    });

    assert.ok(result && result.ok === true);
    assert.equal(result.traceId, 'req_phase900_t83');
    assert.equal(result.actor, 'unknown');

    const warningEntries = audits.filter((entry) => entry && entry.action === 'managed_flow.guard.warning');
    const warningReasons = warningEntries
      .map((entry) => entry && entry.payloadSummary && entry.payloadSummary.reason);
    assert.deepEqual(warningReasons, ['trace_fallback', 'actor_fallback']);

    const traceWarning = warningEntries[0];
    assert.equal(traceWarning.actor, 'unknown');
    assert.equal(traceWarning.traceId, 'req_phase900_t83');

    const actorWarning = warningEntries[1];
    assert.equal(actorWarning.actor, 'unknown');
    assert.equal(actorWarning.traceId, 'req_phase900_t83');
  } finally {
    restore();
  }
});
