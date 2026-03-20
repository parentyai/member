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

async function withOsDeliveryBackfillHandlers(overrides, run) {
  const usecasePath = require.resolve('../../src/usecases/deliveries/deliveryBackfillAdmin');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const routePath = require.resolve('../../src/routes/admin/osDeliveryBackfill');

  const originalUsecase = require.cache[usecasePath];
  const originalAudit = require.cache[auditPath];
  const originalRoute = require.cache[routePath];

  require.cache[usecasePath] = {
    id: usecasePath,
    filename: usecasePath,
    loaded: true,
    exports: Object.assign({
      normalizeLimit: (value) => {
        const num = Number(value);
        if (!Number.isFinite(num) || num < 1 || num > 1000) return null;
        return Math.floor(num);
      },
      confirmTokenData: (planHash, limit) => ({
        planHash,
        templateKey: 'delivery_backfill',
        templateVersion: '',
        segmentKey: String(limit || '')
      }),
      getBackfillStatus: async ({ limit, traceId, requestId }) => ({
        ok: true,
        traceId,
        requestId,
        summaryAfter: { fixableCount: 0 },
        result: { skippedCount: 0 },
        limit
      }),
      planBackfill: async ({ limit }) => ({
        ok: true,
        planHash: `plan_${limit}`,
        limit
      }),
      executeBackfill: async () => ({
        statusCode: 200,
        body: {
          ok: true,
          result: { skippedCount: 0 },
          summaryAfter: { fixableCount: 0 }
        }
      })
    }, overrides && overrides.deliveryBackfillAdmin || {})
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
    const handlers = require('../../src/routes/admin/osDeliveryBackfill');
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

test('phase900: os delivery backfill status success emits routeKey and outcome headers', async () => {
  await withOsDeliveryBackfillHandlers({}, async ({ handleStatus }) => {
    const res = createResCapture();
    await handleStatus({
      method: 'GET',
      url: '/api/admin/os/delivery-backfill/status?limit=10',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t49_status',
        'x-request-id': 'req_phase900_t49_status'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'status_viewed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin_os_delivery_backfill');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'status_viewed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: os delivery backfill execute confirm token mismatch emits blocked outcome contract', async () => {
  await withOsDeliveryBackfillHandlers({}, async ({ handleExecute }) => {
    const res = createResCapture();
    await handleExecute({
      method: 'POST',
      url: '/api/admin/os/delivery-backfill/execute',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t49_execute'
      }
    }, res, JSON.stringify({
      limit: 10,
      planHash: 'plan_10',
      confirmToken: 'invalid_confirm_token'
    }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 409);
    assert.equal(body.ok, false);
    assert.equal(body.reason, 'confirm_token_mismatch');
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'confirm_token_mismatch');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin_os_delivery_backfill');
    assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'confirm_token_mismatch');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});
