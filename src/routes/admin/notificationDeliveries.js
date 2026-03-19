'use strict';

const { getNotificationDeliveries } = require('../../usecases/deliveries/getNotificationDeliveries');
const { resolveActor, resolveRequestId, resolveTraceId } = require('./osContext');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.notification_deliveries';

function normalizeOutcomeOptions(outcomeOptions) {
  const input = outcomeOptions && typeof outcomeOptions === 'object' ? outcomeOptions : {};
  const guard = input.guard && typeof input.guard === 'object' ? input.guard : {};
  return Object.assign({}, input, {
    routeType: ROUTE_TYPE,
    guard: Object.assign({}, guard, { routeKey: ROUTE_KEY })
  });
}

function writeJson(res, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function resolveDeliveriesErrorReason(message) {
  const text = typeof message === 'string' ? message : 'error';
  if (text === 'lineUserId or memberId required') return 'line_user_id_or_member_id_required';
  return 'error';
}

async function handleNotificationDeliveries(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = (url.searchParams.get('lineUserId') || '').trim();
  const memberId = (url.searchParams.get('memberId') || '').trim();
  const memberNumber = (url.searchParams.get('memberNumber') || memberId || '').trim();
  const limit = url.searchParams.get('limit');
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const actor = resolveActor(req);

  try {
    const payload = await getNotificationDeliveries({
      lineUserId,
      memberId,
      memberNumber,
      limit,
      traceId,
      requestId,
      actor
    });
    writeJson(res, 200, payload, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    if (err && Number.isInteger(err.statusCode)) {
      writeJson(res, err.statusCode, { ok: false, error: err.message || 'error' }, {
        state: 'error',
        reason: resolveDeliveriesErrorReason(err.message),
        guard: { decision: 'block' }
      });
      return;
    }
    writeJson(res, 500, { ok: false, error: err && err.message ? err.message : 'error' }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleNotificationDeliveries
};
