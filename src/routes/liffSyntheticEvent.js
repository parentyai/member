'use strict';

const { normalizeLiffSilentPayload } = require('../v1/channel_edge/line/liffSilentNormalizer');
const { appendAuditLog } = require('../usecases/audit/appendAuditLog');
const { createEvent } = require('../repos/firestore/eventsRepo');

async function handleLiffSyntheticEvent(req, res, body) {
  if (req.method !== 'POST') {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(body || '{}');
  } catch (_err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'invalid_json' }));
    return;
  }

  const normalized = normalizeLiffSilentPayload(payload);
  if (!normalized.ok) {
    res.writeHead(422, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: normalized.reason, traceId: normalized.traceId }));
    return;
  }

  await createEvent({
    type: 'liff.synthetic_event',
    lineUserId: normalized.syntheticEvent.source.userId,
    traceId: normalized.traceId,
    payloadSummary: {
      sourceType: normalized.syntheticEvent.source.type,
      synthetic: true,
      origin: 'liff_silent_path'
    },
    createdAt: new Date().toISOString()
  });

  await appendAuditLog({
    actor: normalized.syntheticEvent.source.userId,
    action: 'line_liff.synthetic_event.accepted',
    entityType: 'liff_synthetic_event',
    entityId: normalized.syntheticEvent.webhookEventId,
    traceId: normalized.traceId,
    payloadSummary: {
      synthetic: true,
      origin: 'liff_silent_path'
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, traceId: normalized.traceId, webhookEventId: normalized.syntheticEvent.webhookEventId }));
}

module.exports = {
  handleLiffSyntheticEvent
};
