'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const {
  isCanonicalCoreOutboxDualWriteEnabled,
  isCanonicalCoreOutboxStrictEnabled,
  buildCanonicalCoreOutboxEvent
} = require('../../domain/data/canonicalCoreBridge');

const COLLECTION = 'canonical_core_outbox';

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

module.exports = {
  appendCanonicalCoreOutboxEvent
};
