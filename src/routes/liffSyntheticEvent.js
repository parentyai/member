'use strict';

const { normalizeLiffSilentPayload } = require('../v1/channel_edge/line/liffSilentNormalizer');
const { appendAuditLog } = require('../usecases/audit/appendAuditLog');
const { createEvent } = require('../repos/firestore/eventsRepo');

async function defaultProcessSyntheticEvent(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const normalized = payload.normalized && typeof payload.normalized === 'object' ? payload.normalized : null;
  const originalPayload = payload.originalPayload && typeof payload.originalPayload === 'object' ? payload.originalPayload : {};
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim()
    ? payload.traceId.trim()
    : (normalized && normalized.traceId ? normalized.traceId : null);
  if (!normalized || !normalized.syntheticEvent) {
    return { status: 400, body: 'invalid synthetic payload' };
  }
  const destination = typeof originalPayload.destination === 'string' && originalPayload.destination.trim()
    ? originalPayload.destination.trim()
    : 'liff_synthetic_destination';
  const { handleLineWebhook } = require('./webhookLine');
  return handleLineWebhook({
    trustedPayload: {
      destination,
      events: [normalized.syntheticEvent]
    },
    requestId: traceId,
    traceId,
    logger: () => {},
    allowWelcome: true
  });
}

async function handleLiffSyntheticEvent(req, res, body, deps) {
  const overrides = deps && typeof deps === 'object' ? deps : {};
  const createEventFn = typeof overrides.createEvent === 'function' ? overrides.createEvent : createEvent;
  const appendAuditLogFn = typeof overrides.appendAuditLog === 'function' ? overrides.appendAuditLog : appendAuditLog;
  const processSyntheticEventFn = typeof overrides.processSyntheticEvent === 'function'
    ? overrides.processSyntheticEvent
    : defaultProcessSyntheticEvent;

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

  await createEventFn({
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

  await appendAuditLogFn({
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

  let processResult = null;
  let processError = null;
  try {
    processResult = await processSyntheticEventFn({
      normalized,
      originalPayload: payload,
      traceId: normalized.traceId
    });
  } catch (err) {
    processError = err;
  }
  const processStatus = processResult && Number.isFinite(Number(processResult.status))
    ? Number(processResult.status)
    : 500;
  const processOk = processError === null && processStatus >= 200 && processStatus < 300;
  await appendAuditLogFn({
    actor: normalized.syntheticEvent.source.userId,
    action: processOk
      ? 'line_liff.synthetic_event.processed'
      : 'line_liff.synthetic_event.processing_failed',
    entityType: 'liff_synthetic_event',
    entityId: normalized.syntheticEvent.webhookEventId,
    traceId: normalized.traceId,
    payloadSummary: {
      synthetic: true,
      origin: 'liff_silent_path',
      processStatus,
      processReason: processError && processError.message ? String(processError.message).slice(0, 160) : null
    }
  });

  if (!processOk) {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: false,
      reason: 'synthetic_processing_failed',
      traceId: normalized.traceId,
      webhookEventId: normalized.syntheticEvent.webhookEventId
    }));
    return;
  }

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId: normalized.traceId,
    webhookEventId: normalized.syntheticEvent.webhookEventId,
    processed: true
  }));
}

module.exports = {
  defaultProcessSyntheticEvent,
  handleLiffSyntheticEvent
};
