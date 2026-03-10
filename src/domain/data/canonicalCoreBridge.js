'use strict';

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return defaultValue === true;
}

function isCanonicalCoreOutboxDualWriteEnabled() {
  return resolveBooleanEnvFlag('ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1', false);
}

function isCanonicalCoreOutboxStrictEnabled() {
  return resolveBooleanEnvFlag('ENABLE_CANONICAL_CORE_OUTBOX_STRICT_V1', false);
}

function normalizeObjectType(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return 'unknown_object';
  if ([
    'source_snapshot',
    'evidence_claim',
    'knowledge_object',
    'policy_rule',
    'publish_bundle',
    'delivery_record'
  ].includes(normalized)) {
    return normalized;
  }
  return 'unknown_object';
}

function normalizeEventType(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return 'upsert';
  if (['upsert', 'delete', 'status_change'].includes(normalized)) return normalized;
  return 'upsert';
}

function normalizePayloadSummary(value) {
  const payload = value && typeof value === 'object' ? value : {};
  return {
    lifecycleState: typeof payload.lifecycleState === 'string' ? payload.lifecycleState.trim().toLowerCase() : null,
    lifecycleBucket: typeof payload.lifecycleBucket === 'string' ? payload.lifecycleBucket.trim().toLowerCase() : null,
    status: typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : null,
    locale: typeof payload.locale === 'string' ? payload.locale.trim().toLowerCase() : null,
    riskLevel: typeof payload.riskLevel === 'string' ? payload.riskLevel.trim().toLowerCase() : null
  };
}

function buildCanonicalCoreOutboxEvent(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const envelope = payload.recordEnvelope && typeof payload.recordEnvelope === 'object' ? payload.recordEnvelope : {};
  return {
    objectType: normalizeObjectType(payload.objectType),
    objectId: typeof payload.objectId === 'string' && payload.objectId.trim() ? payload.objectId.trim() : 'unknown_object_id',
    eventType: normalizeEventType(payload.eventType),
    sourceSystem: typeof envelope.source_system === 'string' && envelope.source_system.trim()
      ? envelope.source_system.trim()
      : 'member_firestore',
    sourceSnapshotRef: typeof envelope.source_snapshot_ref === 'string' && envelope.source_snapshot_ref.trim()
      ? envelope.source_snapshot_ref.trim()
      : 'snapshot:unknown',
    effectiveFrom: envelope.effective_from || null,
    effectiveTo: envelope.effective_to || null,
    authorityTier: envelope.authority_tier || 'UNKNOWN',
    bindingLevel: envelope.binding_level || 'UNKNOWN',
    jurisdiction: envelope.jurisdiction || null,
    payloadSummary: normalizePayloadSummary(payload.payloadSummary),
    traceId: typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null,
    recordEnvelope: envelope
  };
}

module.exports = {
  isCanonicalCoreOutboxDualWriteEnabled,
  isCanonicalCoreOutboxStrictEnabled,
  buildCanonicalCoreOutboxEvent
};
