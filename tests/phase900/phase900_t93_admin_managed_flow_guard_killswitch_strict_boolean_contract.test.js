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

test('phase900: managed flow guard requires strict boolean true for killSwitchChecked', async () => {
  const actionKey = 'managed_flow.killswitch.strict_boolean';
  const flow = {
    flowId: 'flow_killswitch_strict_boolean',
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
    const res = createResCapture();
    const result = await guardModule.enforceManagedFlowGuard({
      req: {
        method: 'POST',
        url: '/api/admin/custom/killswitch-strict-boolean',
        headers: {
          'x-trace-id': 'trace_phase900_t93',
          'x-actor': 'phase900_actor'
        }
      },
      res,
      actionKey,
      payload: {
        planHash: 'plan_phase900_t93',
        confirmToken: 'confirm_phase900_t93',
        killSwitchChecked: 'true'
      }
    }, {
      appendAuditLog: async (entry) => {
        audits.push(entry);
      }
    });

    const body = res.readJson();
    assert.equal(result, null);
    assert.equal(res.result.statusCode, 409);
    assert.equal(body.error, 'kill_switch_check_required');
    assert.equal(body.outcome && body.outcome.reason, 'kill_switch_check_required');

    const violationReasons = audits
      .filter((entry) => entry && entry.action === 'managed_flow.guard.violation')
      .map((entry) => entry && entry.payloadSummary && entry.payloadSummary.reason);
    assert.ok(violationReasons.includes('kill_switch_check_required'));
  } finally {
    restore();
  }
});
