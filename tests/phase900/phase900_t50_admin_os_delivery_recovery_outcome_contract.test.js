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

async function withOsDeliveryRecoveryHandlers(overrides, run) {
  const usecasePath = require.resolve('../../src/usecases/deliveries/deliveryRecoveryAdmin');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const routePath = require.resolve('../../src/routes/admin/osDeliveryRecovery');

  const originalUsecase = require.cache[usecasePath];
  const originalAudit = require.cache[auditPath];
  const originalRoute = require.cache[routePath];

  require.cache[usecasePath] = {
    id: usecasePath,
    filename: usecasePath,
    loaded: true,
    exports: Object.assign({
      normalizeDeliveryId: (value) => {
        const deliveryId = String(value || '').trim();
        if (!deliveryId) throw new Error('deliveryId required');
        return deliveryId;
      },
      normalizeReason: (value) => {
        const reason = String(value || '').trim();
        if (!reason) throw new Error('sealedReason required');
        return reason;
      },
      computePlanHash: (deliveryId, sealedReason) => `plan_${deliveryId}_${sealedReason}`,
      confirmTokenData: (planHash, deliveryId) => ({
        planHash,
        templateKey: 'delivery_recovery',
        templateVersion: '',
        segmentKey: deliveryId
      }),
      getRecoveryStatus: async ({ deliveryId, traceId, requestId }) => ({
        statusCode: 200,
        body: {
          ok: true,
          deliveryId,
          traceId,
          requestId
        }
      }),
      planRecovery: async () => ({
        statusCode: 409,
        body: {
          ok: false,
          reason: 'already_delivered'
        }
      }),
      executeRecovery: async () => ({
        statusCode: 200,
        body: {
          ok: true,
          alreadySealed: false
        }
      })
    }, overrides && overrides.deliveryRecoveryAdmin || {})
  };

  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: Object.assign({
      appendAuditLog: async () => ({ id: 'audit_stub' })
    }, overrides && overrides.appendAuditLog || {})
  };

  delete require.cache[routePath];
  try {
    const handlers = require('../../src/routes/admin/osDeliveryRecovery');
    await run(handlers);
  } finally {
    if (originalUsecase) require.cache[usecasePath] = originalUsecase;
    else delete require.cache[usecasePath];
    if (originalAudit) require.cache[auditPath] = originalAudit;
    else delete require.cache[auditPath];
    if (originalRoute) require.cache[routePath] = originalRoute;
    else delete require.cache[routePath];
  }
}

test('phase900: os delivery recovery status success emits routeKey and outcome headers', async () => {
  await withOsDeliveryRecoveryHandlers({}, async ({ handleStatus }) => {
    const res = createResCapture();
    await handleStatus({
      method: 'GET',
      url: '/api/admin/os/delivery-recovery/status?deliveryId=delivery_phase900_t50',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t50_status',
        'x-request-id': 'req_phase900_t50_status'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'status_viewed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin_os_delivery_recovery');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'status_viewed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: os delivery recovery plan already delivered emits blocked outcome contract', async () => {
  await withOsDeliveryRecoveryHandlers({}, async ({ handlePlan }) => {
    const res = createResCapture();
    await handlePlan({
      method: 'POST',
      url: '/api/admin/os/delivery-recovery/plan',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t50_plan'
      }
    }, res, JSON.stringify({
      deliveryId: 'delivery_phase900_t50',
      sealedReason: 'manual'
    }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 409);
    assert.equal(body.ok, false);
    assert.equal(body.reason, 'already_delivered');
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'already_delivered');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin_os_delivery_recovery');
    assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'already_delivered');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});
