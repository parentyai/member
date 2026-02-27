'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { enforceManagedFlowGuard } = require('../../src/routes/admin/managedFlowGuard');

function createResCapture() {
  const capture = {
    status: null,
    body: null
  };
  const res = {
    writeHead(statusCode) {
      capture.status = statusCode;
    },
    end(payload) {
      capture.body = payload;
    }
  };
  return { res, capture };
}

test('phase674: managed flow guard enforces trace/actor/confirm in strict actor mode', async () => {
  const audits = [];
  const deps = {
    appendAuditLog: async (entry) => {
      audits.push(entry);
    }
  };

  {
    const { res, capture } = createResCapture();
    const result = await enforceManagedFlowGuard({
      req: { headers: { 'x-actor': 'admin' } },
      res,
      actionKey: 'notifications.approve',
      payload: { notificationId: 'n_1' }
    }, deps);
    assert.equal(result, null);
    assert.equal(capture.status, 400);
    assert.match(String(capture.body || ''), /x-trace-id required/);
  }

  {
    const { res, capture } = createResCapture();
    const result = await enforceManagedFlowGuard({
      req: { headers: { 'x-trace-id': 'trace-1' } },
      res,
      actionKey: 'notifications.approve',
      payload: { notificationId: 'n_1' }
    }, deps);
    assert.equal(result, null);
    assert.equal(capture.status, 400);
    assert.match(String(capture.body || ''), /x-actor required/);
  }

  {
    const { res, capture } = createResCapture();
    const result = await enforceManagedFlowGuard({
      req: { headers: { 'x-trace-id': 'trace-2', 'x-actor': 'admin' } },
      res,
      actionKey: 'notifications.send.execute',
      payload: { notificationId: 'n_2' }
    }, deps);
    assert.equal(result, null);
    assert.equal(capture.status, 400);
    assert.match(String(capture.body || ''), /planHash\/confirmToken required/);
  }

  {
    const { res, capture } = createResCapture();
    const result = await enforceManagedFlowGuard({
      req: { headers: { 'x-trace-id': 'trace-3' } },
      res,
      actionKey: 'city_pack.bulletin.approve',
      payload: { notificationId: 'n_3' }
    }, deps);
    assert.equal(result, null);
    assert.equal(capture.status, 400);
    assert.match(String(capture.body || ''), /x-actor required/);
  }

  {
    const { res, capture } = createResCapture();
    const result = await enforceManagedFlowGuard({
      req: { headers: { 'x-trace-id': 'trace-3b', 'x-actor': 'admin' } },
      res,
      actionKey: 'city_pack.bulletin.approve',
      payload: { bulletinId: 'cp_1' }
    }, deps);
    assert.ok(result && result.ok === true);
    assert.equal(result.actor, 'admin');
    assert.equal(result.traceId, 'trace-3b');
    assert.equal(capture.status, null);
  }

  {
    const { res, capture } = createResCapture();
    const result = await enforceManagedFlowGuard({
      req: { headers: { 'x-trace-id': 'trace-4' } },
      res,
      actionKey: 'vendors.activate',
      payload: { linkId: 'link_1' }
    }, deps);
    assert.equal(result, null);
    assert.equal(capture.status, 400);
    assert.match(String(capture.body || ''), /x-actor required/);
  }

  {
    const { res, capture } = createResCapture();
    const result = await enforceManagedFlowGuard({
      req: { headers: { 'x-trace-id': 'trace-5' } },
      res,
      actionKey: 'emergency.bulletin.approve',
      payload: { bulletinId: 'b_1' }
    }, deps);
    assert.equal(result, null);
    assert.equal(capture.status, 400);
    assert.match(String(capture.body || ''), /x-actor required/);
  }

  assert.equal(audits.some((entry) => entry && entry.action === 'managed_flow.guard.warning'), false);
  assert.ok(audits.some((entry) => entry && entry.action === 'managed_flow.guard.violation'));
});
