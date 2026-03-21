'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { getManagedFlowRegistry } = require('../../src/domain/managedFlowRegistry');
const { enforceManagedFlowGuard } = require('../../src/routes/admin/managedFlowGuard');

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

function concretePathFromPattern(pathPattern) {
  const raw = String(pathPattern || '').trim();
  if (!raw || raw === '/') return '/';
  const normalized = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  return normalized.replace(/:([A-Za-z0-9_]+)/g, 'sample');
}

function findMismatchPair(registry) {
  const actions = Object.values(registry.actionByKey || {});
  for (let i = 0; i < actions.length; i += 1) {
    for (let j = 0; j < actions.length; j += 1) {
      if (i === j) continue;
      const left = actions[i];
      const right = actions[j];
      if (String(left.method).trim().toUpperCase() === String(right.method).trim().toUpperCase()) {
        return { expected: left, resolved: right };
      }
    }
  }
  return null;
}

test('phase900: managed flow guard blocks when actionKey mismatches method/path-resolved binding', async () => {
  const registry = getManagedFlowRegistry();
  const pair = findMismatchPair(registry);
  assert.ok(pair, 'expected at least two managed-flow actions with the same method');

  const res = createResCapture();
  const result = await enforceManagedFlowGuard({
    req: {
      method: pair.resolved.method,
      url: concretePathFromPattern(pair.resolved.pathPattern),
      headers: {
        'x-trace-id': 'trace_phase900_guard_mismatch',
        'x-actor': 'phase900_actor'
      }
    },
    res,
    actionKey: pair.expected.actionKey,
    payload: {
      planHash: 'plan_phase900_mismatch',
      confirmToken: 'confirm_phase900_mismatch',
      killSwitchChecked: true
    }
  }, {
    appendAuditLog: async () => ({ id: 'audit_phase900_guard_mismatch' })
  });

  const body = res.readJson();
  assert.equal(result, null);
  assert.equal(res.result.statusCode, 500);
  assert.equal(body.error, 'managed_flow_action_mismatch');
  assert.equal(body.actionKey, pair.expected.actionKey);
  assert.equal(body.resolvedActionKey, pair.resolved.actionKey);
  assert.equal(body.outcome && body.outcome.reason, 'managed_flow_action_mismatch');
});
