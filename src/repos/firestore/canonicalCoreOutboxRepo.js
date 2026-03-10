'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const {
  isCanonicalCoreOutboxDualWriteEnabled,
  isCanonicalCoreOutboxStrictEnabled,
  buildCanonicalCoreOutboxEvent
} = require('../../domain/data/canonicalCoreBridge');

const COLLECTION = 'canonical_core_outbox';
const ALLOWED_SINK_STATUS = new Set(['pending', 'synced', 'failed']);

function resolveEventId(event) {
  const payload = event && typeof event === 'object' ? event : {};
  const hash = crypto
    .createHash('sha256')
    .update([
      payload.objectType || 'unknown_object',
      payload.objectId || 'unknown_object_id',
      payload.eventType || 'upsert',
      payload.sourceSnapshotRef || 'snapshot:unknown',
      payload.effectiveFrom || 'unknown_effective_from'
    ].join('|'))
    .digest('hex')
    .slice(0, 32);
  return `cco_${hash}`;
}

async function appendCanonicalCoreOutboxEvent(params) {
  if (!isCanonicalCoreOutboxDualWriteEnabled()) {
    return {
      skipped: true,
      reason: 'dual_write_disabled',
      strict: isCanonicalCoreOutboxStrictEnabled()
    };
  }

  const strict = isCanonicalCoreOutboxStrictEnabled();
  const event = buildCanonicalCoreOutboxEvent(params);
  const eventId = resolveEventId(event);
  const payload = {
    objectType: event.objectType,
    objectId: event.objectId,
    eventType: event.eventType,
    sourceSystem: event.sourceSystem,
    sourceSnapshotRef: event.sourceSnapshotRef,
    effectiveFrom: event.effectiveFrom,
    effectiveTo: event.effectiveTo,
    authorityTier: event.authorityTier,
    bindingLevel: event.bindingLevel,
    jurisdiction: event.jurisdiction,
    payloadSummary: event.payloadSummary,
    traceId: event.traceId,
    recordEnvelope: event.recordEnvelope,
    sinkStatus: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    const db = getDb();
    await db.collection(COLLECTION).doc(eventId).set(payload, { merge: true });
    return { id: eventId, skipped: false };
  } catch (error) {
    if (strict) throw error;
    return {
      skipped: true,
      reason: 'append_failed',
      errorCode: error && error.code ? String(error.code) : 'canonical_core_outbox_append_failed',
      strict
    };
  }
}

function normalizeLimit(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), 500);
}

function normalizeSinkStatus(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return fallback;
  return ALLOWED_SINK_STATUS.has(normalized) ? normalized : fallback;
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value.toDate === 'function') {
    const asDate = value.toDate();
    if (asDate instanceof Date) {
      const ms = asDate.getTime();
      return Number.isFinite(ms) ? ms : 0;
    }
  }
  if (typeof value.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? ms : 0;
  }
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function listCanonicalCoreOutboxEvents(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const status = normalizeSinkStatus(payload.status, 'pending');
  const limit = normalizeLimit(payload.limit, 100);
  const db = getDb();
  const snap = await db
    .collection(COLLECTION)
    .where('sinkStatus', '==', status)
    .limit(limit)
    .get();
  return snap.docs
    .map((doc) => Object.assign({ id: doc.id }, doc.data()))
    .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
}

async function markCanonicalCoreOutboxEventSynced(eventId, extras) {
  if (!eventId) throw new Error('eventId required');
  const payload = extras && typeof extras === 'object' ? extras : {};
  const db = getDb();
  await db.collection(COLLECTION).doc(eventId).set({
    sinkStatus: 'synced',
    sinkErrorCode: null,
    sinkErrorMessage: null,
    canonicalRecordId: typeof payload.canonicalRecordId === 'string' && payload.canonicalRecordId.trim()
      ? payload.canonicalRecordId.trim()
      : null,
    syncedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { id: eventId, sinkStatus: 'synced' };
}

async function markCanonicalCoreOutboxEventFailed(eventId, error) {
  if (!eventId) throw new Error('eventId required');
  const code = error && error.code ? String(error.code) : 'canonical_core_sync_failed';
  const message = error && error.message ? String(error.message) : 'canonical core sync failed';
  const db = getDb();
  await db.collection(COLLECTION).doc(eventId).set({
    sinkStatus: 'failed',
    sinkErrorCode: code.slice(0, 120),
    sinkErrorMessage: message.slice(0, 500),
    failedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { id: eventId, sinkStatus: 'failed' };
}

module.exports = {
  appendCanonicalCoreOutboxEvent,
  listCanonicalCoreOutboxEvents,
  markCanonicalCoreOutboxEventSynced,
  markCanonicalCoreOutboxEventFailed
};
