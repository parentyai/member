'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'ux_events';
const RETENTION_DAYS = 35;
const EVENT_TYPES = Object.freeze(['notification_sent', 'reaction_received']);
const REACTION_ACTIONS = new Set(['open', 'save', 'snooze', 'none', 'redeem', 'response']);

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeEventType(value) {
  const normalized = normalizeText(value, '');
  if (!normalized) throw new Error('eventType required');
  if (!EVENT_TYPES.includes(normalized)) throw new Error('invalid eventType');
  return normalized;
}

function normalizeAction(value) {
  const normalized = normalizeText(value, '').toLowerCase();
  if (!normalized) throw new Error('action required');
  if (!REACTION_ACTIONS.has(normalized)) throw new Error('invalid action');
  return normalized;
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function buildEventId(eventType, deliveryId, action) {
  if (eventType === 'notification_sent') return `notification_sent__${deliveryId}`;
  return `reaction_received__${deliveryId}__${action}`;
}

function resolveExpiryIso(baseIso) {
  const base = toIso(baseIso) || new Date().toISOString();
  const ms = Date.parse(base);
  if (!Number.isFinite(ms)) return new Date(Date.now() + (RETENTION_DAYS * 24 * 60 * 60 * 1000)).toISOString();
  return new Date(ms + (RETENTION_DAYS * 24 * 60 * 60 * 1000)).toISOString();
}

function normalizePayload(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const eventType = normalizeEventType(payload.eventType);
  const deliveryId = normalizeText(payload.deliveryId, '');
  if (!deliveryId) throw new Error('deliveryId required');

  const action = eventType === 'reaction_received'
    ? normalizeAction(payload.action)
    : null;

  const eventId = buildEventId(eventType, deliveryId, action);
  const createdAtIso = toIso(payload.createdAt);
  const occurredAt = toIso(payload.occurredAt || payload.sentAt || payload.at);

  const record = {
    eventId,
    eventType,
    deliveryId,
    action,
    notificationId: normalizeText(payload.notificationId, null),
    lineUserId: normalizeText(payload.lineUserId, null),
    notificationCategory: normalizeText(payload.notificationCategory, null),
    traceId: normalizeText(payload.traceId, null),
    requestId: normalizeText(payload.requestId, null),
    actor: normalizeText(payload.actor, null),
    occurredAt,
    retentionDays: RETENTION_DAYS,
    expiresAt: resolveExpiryIso(createdAtIso || occurredAt),
    createdAtIso
  };
  return record;
}

async function appendUxEvent(data) {
  const normalized = normalizePayload(data);
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(normalized.eventId);
  const writePayload = {
    eventId: normalized.eventId,
    eventType: normalized.eventType,
    deliveryId: normalized.deliveryId,
    action: normalized.action,
    notificationId: normalized.notificationId,
    lineUserId: normalized.lineUserId,
    notificationCategory: normalized.notificationCategory,
    traceId: normalized.traceId,
    requestId: normalized.requestId,
    actor: normalized.actor,
    occurredAt: normalized.occurredAt,
    retentionDays: normalized.retentionDays,
    expiresAt: normalized.expiresAt,
    createdAt: normalized.createdAtIso || serverTimestamp()
  };
  let idempotent = false;

  if (typeof db.runTransaction === 'function') {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (snap && snap.exists) {
        idempotent = true;
        return;
      }
      tx.set(docRef, writePayload, { merge: false });
    });
  } else {
    const snap = await docRef.get();
    if (snap && snap.exists) {
      idempotent = true;
    } else {
      await docRef.set(writePayload, { merge: false });
    }
  }

  return {
    id: normalized.eventId,
    eventType: normalized.eventType,
    deliveryId: normalized.deliveryId,
    idempotent
  };
}

module.exports = {
  COLLECTION,
  RETENTION_DAYS,
  EVENT_TYPES,
  appendUxEvent
};
