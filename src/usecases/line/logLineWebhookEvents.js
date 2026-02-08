'use strict';

const eventsRepo = require('../../repos/firestore/eventsRepo');

function normalizeEventType(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'line_webhook.unknown';
  return `line_webhook.${raw}`;
}

function extractLineUserId(event) {
  const source = event && event.source && typeof event.source === 'object' ? event.source : null;
  const userId = source && typeof source.userId === 'string' ? source.userId.trim() : '';
  return userId || null;
}

function extractRef(event, requestId) {
  const source = event && event.source && typeof event.source === 'object' ? event.source : {};
  const message = event && event.message && typeof event.message === 'object' ? event.message : {};
  const ref = {
    requestId: requestId || null,
    webhookEventId: typeof event.webhookEventId === 'string' ? event.webhookEventId : null,
    timestampMs: typeof event.timestamp === 'number' ? event.timestamp : null,
    sourceType: typeof source.type === 'string' ? source.type : null,
    groupId: typeof source.groupId === 'string' ? source.groupId : null,
    roomId: typeof source.roomId === 'string' ? source.roomId : null,
    messageId: typeof message.id === 'string' ? message.id : null,
    messageType: typeof message.type === 'string' ? message.type : null
  };
  return ref;
}

async function logLineWebhookEvents(params, deps) {
  const payload = params || {};
  const body = payload.payload || {};
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : null;
  const repo = deps && deps.eventsRepo ? deps.eventsRepo : eventsRepo;

  const events = Array.isArray(body.events) ? body.events : [];
  let appended = 0;
  let skipped = 0;

  for (const event of events) {
    const lineUserId = extractLineUserId(event);
    if (!lineUserId) {
      skipped += 1;
      continue;
    }
    const type = normalizeEventType(event && event.type);
    const ref = extractRef(event, requestId);
    await repo.createEvent({ lineUserId, type, ref });
    appended += 1;
  }

  return { ok: true, appended, skipped };
}

async function logLineWebhookEventsBestEffort(params, deps) {
  try {
    return await logLineWebhookEvents(params, deps);
  } catch (_err) {
    return { ok: false, appended: 0, skipped: 0 };
  }
}

module.exports = {
  logLineWebhookEvents,
  logLineWebhookEventsBestEffort
};

