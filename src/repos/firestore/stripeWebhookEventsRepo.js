'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'stripe_webhook_events';

function normalizeId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeStatus(value) {
  if (typeof value !== 'string') return 'received';
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'received';
  if (['received', 'processed', 'ignored', 'duplicate', 'dead_letter', 'error', 'stale_ignored'].includes(normalized)) {
    return normalized;
  }
  return 'received';
}

function toIsoOrNull(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function normalizeEvent(eventId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    id: normalizeId(eventId),
    eventId: normalizeId(eventId),
    eventType: typeof payload.eventType === 'string' ? payload.eventType : '',
    status: normalizeStatus(payload.status),
    userId: typeof payload.userId === 'string' && payload.userId.trim() ? payload.userId.trim() : null,
    errorCode: typeof payload.errorCode === 'string' && payload.errorCode.trim() ? payload.errorCode.trim() : null,
    requestId: typeof payload.requestId === 'string' && payload.requestId.trim() ? payload.requestId.trim() : null,
    receivedAt: payload.receivedAt || null,
    processedAt: payload.processedAt || null,
    stripeEventCreated: toIsoOrNull(payload.stripeEventCreated)
  };
}

async function getStripeWebhookEvent(eventId) {
  const id = normalizeId(eventId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeEvent(id, snap.data());
}

async function reserveStripeWebhookEvent(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const eventId = normalizeId(payload.eventId);
  if (!eventId) throw new Error('eventId required');
  const eventType = typeof payload.eventType === 'string' ? payload.eventType.trim() : '';
  const requestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : null;
  const stripeEventCreated = toIsoOrNull(payload.stripeEventCreated);
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(eventId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.exists) {
      return {
        created: false,
        event: normalizeEvent(eventId, snap.data())
      };
    }

    const doc = {
      eventType,
      status: 'received',
      requestId,
      stripeEventCreated,
      receivedAt: payload.receivedAt || serverTimestamp(),
      processedAt: null,
      userId: null,
      errorCode: null
    };
    tx.set(docRef, doc, { merge: false });

    return {
      created: true,
      event: normalizeEvent(eventId, doc)
    };
  });
}

async function updateStripeWebhookEvent(eventId, patch) {
  const id = normalizeId(eventId);
  if (!id) throw new Error('eventId required');
  const payload = patch && typeof patch === 'object' ? patch : {};
  const doc = {
    status: normalizeStatus(payload.status),
    processedAt: payload.processedAt || serverTimestamp(),
    userId: typeof payload.userId === 'string' && payload.userId.trim() ? payload.userId.trim() : null,
    errorCode: typeof payload.errorCode === 'string' && payload.errorCode.trim() ? payload.errorCode.trim() : null
  };
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(doc, { merge: true });
  return getStripeWebhookEvent(id);
}

module.exports = {
  COLLECTION,
  getStripeWebhookEvent,
  reserveStripeWebhookEvent,
  updateStripeWebhookEvent
};
