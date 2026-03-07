'use strict';

const eventsRepo = require('../../repos/firestore/eventsRepo');
const { isUxosEventsEnabled } = require('../../domain/uxos/featureFlags');

const ALLOWED_EVENT_TYPES = new Set([
  'reaction_received',
  'notification_sent'
]);

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeEventType(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_EVENT_TYPES.has(lowered)) return null;
  return lowered;
}

function normalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

async function appendUxEvent(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  if (!isUxosEventsEnabled()) {
    return { ok: false, skipped: true, reason: 'disabled_by_flag' };
  }

  const lineUserId = normalizeText(payload.lineUserId);
  if (!lineUserId) {
    return { ok: false, skipped: true, reason: 'lineUserId_required' };
  }

  const uxEventType = normalizeEventType(payload.uxEventType);
  if (!uxEventType) {
    return { ok: false, skipped: true, reason: 'uxEventType_invalid' };
  }

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repository = resolvedDeps.eventsRepo || eventsRepo;
  const ref = normalizeObject(payload.ref);
  const metrics = normalizeObject(payload.metrics);
  const eventVersion = Number.isFinite(Number(payload.eventVersion)) ? Math.floor(Number(payload.eventVersion)) : 1;
  const source = normalizeText(payload.source) || 'uxos_foundation_p0';
  const actor = normalizeText(payload.actor);
  const traceId = normalizeText(payload.traceId);
  const requestId = normalizeText(payload.requestId);

  const created = await repository.createEvent({
    lineUserId,
    type: 'ux_event',
    uxEventType,
    eventVersion: Math.max(1, eventVersion),
    source,
    actor,
    traceId,
    requestId,
    ref,
    metrics
  });

  return {
    ok: true,
    id: created && created.id ? created.id : null,
    lineUserId,
    uxEventType
  };
}

module.exports = {
  ALLOWED_EVENT_TYPES,
  appendUxEvent
};
