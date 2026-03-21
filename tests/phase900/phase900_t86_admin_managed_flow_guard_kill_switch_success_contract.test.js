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

test('phase900: managed flow guard allows execution when required killSwitchChecked is true', async () => {
  const actionKey = 'managed_flow.kill_switch.success';
  const flow = {
    flowId: 'flow_kill_switch_success',
    confirmMode: 'required',
    guardRules: {
      actorMode: 'required',
      traceMode: 'required',
      confirmMode: 'required',
      killSwitchCheck: 'required',
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
        url: '/api/admin/custom/kill-switch-success',
        headers: {
          'x-trace-id': 'trace_phase900_t86',
          'x-actor': 'phase900_actor'
        }
      },
      res: {
        writeHead() {},
        end() {}
      },
      actionKey,
      payload: {
        planHash: 'plan_phase900_t86',
        confirmToken: 'confirm_phase900_t86',
        killSwitchChecked: true
      }
    }, {
      appendAuditLog: async (entry) => {
        audits.push(entry);
      }
    });

    assert.ok(result && result.ok === true);
    assert.equal(result.actionKey, actionKey);
    assert.equal(result.traceId, 'trace_phase900_t86');
    assert.equal(result.actor, 'phase900_actor');

    const violationReasons = audits
      .filter((entry) => entry && entry.action === 'managed_flow.guard.violation')
      .map((entry) => entry && entry.payloadSummary && entry.payloadSummary.reason);
    assert.ok(!violationReasons.includes('kill_switch_check_required'));
  } finally {
    restore();
  }
});
