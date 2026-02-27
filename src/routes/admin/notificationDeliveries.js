'use strict';

const { getNotificationDeliveries } = require('../../usecases/deliveries/getNotificationDeliveries');
const { resolveActor, resolveRequestId, resolveTraceId } = require('./osContext');

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function handleNotificationDeliveries(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = (url.searchParams.get('lineUserId') || '').trim();
  const memberNumber = (url.searchParams.get('memberNumber') || '').trim();
  const limit = url.searchParams.get('limit');
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const actor = resolveActor(req);

  try {
    const payload = await getNotificationDeliveries({
      lineUserId,
      memberNumber,
      limit,
      traceId,
      requestId,
      actor
    });
    writeJson(res, 200, payload);
  } catch (err) {
    if (err && Number.isInteger(err.statusCode)) {
      writeJson(res, err.statusCode, { ok: false, error: err.message || 'error' });
      return;
    }
    writeJson(res, 500, { ok: false, error: err && err.message ? err.message : 'error' });
  }
}

module.exports = {
  handleNotificationDeliveries
};
