'use strict';

const { markDeliveryReactionV2 } = require('../usecases/phase37/markDeliveryReactionV2');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (_err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function resolveHeaderValue(req, name) {
  const value = req && req.headers ? req.headers[name] : null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleReactionV2(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await markDeliveryReactionV2({
      deliveryId: payload.deliveryId,
      action: payload.action,
      lineUserId: payload.lineUserId,
      todoKey: payload.todoKey,
      at: payload.at,
      snoozeUntil: payload.snoozeUntil,
      responseText: payload.responseText,
      traceId: payload.traceId || resolveHeaderValue(req, 'x-trace-id'),
      requestId: payload.requestId || resolveHeaderValue(req, 'x-request-id'),
      actor: resolveHeaderValue(req, 'x-actor') || 'phase37_delivery_reaction_v2'
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleReactionV2
};
