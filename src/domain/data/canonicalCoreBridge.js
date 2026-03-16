'use strict';

const DEFAULT_CANONICAL_CORE_OUTBOX_CONTRACT_VERSION = 'canonical_core_outbox_v2';

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
    'source_registry',
    'source_snapshot',
    'evidence_claim',
    'knowledge_object',
    'task_template',
    'rule_set',
    'exception_playbook',
    'generated_view',
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

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeJsonValue(value) {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeJsonValue(item))
      .filter((item) => item !== undefined);
  }
  if (!value || typeof value !== 'object') return undefined;
  const out = {};
  Object.entries(value).forEach(([key, item]) => {
    if (typeof key !== 'string' || !key.trim()) return;
    const normalized = normalizeJsonValue(item);
    if (normalized === undefined) return;
    out[key.trim()] = normalized;
  });
  return out;
}

function normalizeContractVersion(value) {
  return normalizeText(value, DEFAULT_CANONICAL_CORE_OUTBOX_CONTRACT_VERSION).slice(0, 64);
}

function normalizeCanonicalPayload(value) {
  const normalized = normalizeJsonValue(value);
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) return null;
  const keys = Object.keys(normalized);
  return keys.length > 0 ? normalized : null;
}

function normalizeSourceLink(value) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const sourceId = normalizeText(payload.sourceId, null);
  const snapshotRef = normalizeText(payload.snapshotRef, null);
  const linkRole = normalizeText(payload.linkRole, 'supports').toLowerCase().slice(0, 64);
  const primary = payload.primary === true;
  if (!sourceId && !snapshotRef) return null;
  return {
    sourceId,
    snapshotRef,
    linkRole,
    primary
  };
}

function normalizeSourceLinks(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const rows = [];
  values.forEach((value) => {
    const normalized = normalizeSourceLink(value);
    if (!normalized) return;
    const signature = JSON.stringify(normalized);
    if (seen.has(signature)) return;
    seen.add(signature);
    rows.push(normalized);
  });
  return rows.slice(0, 20);
}

function normalizeTargetTable(value) {
  const normalized = normalizeText(value, '').toLowerCase();
  if (!normalized) return null;
  if ([
    'source_registry',
    'source_snapshot',
    'evidence_claim',
    'knowledge_object',
    'task_template',
    'rule_set',
    'exception_playbook',
    'generated_view'
  ].includes(normalized)) {
    return normalized;
  }
  return null;
}

function normalizeMaterializationHints(value) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const rows = Array.isArray(payload.targetTables)
    ? payload.targetTables.map((item) => normalizeTargetTable(item)).filter(Boolean)
    : [];
  if (!rows.length) return null;
  return {
    targetTables: Array.from(new Set(rows)).slice(0, 12)
  };
}

function buildCanonicalCoreOutboxEvent(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const envelope = payload.recordEnvelope && typeof payload.recordEnvelope === 'object' ? payload.recordEnvelope : {};
  return {
    contractVersion: normalizeContractVersion(payload.contractVersion || payload.contract_version),
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
    canonicalPayload: normalizeCanonicalPayload(payload.canonicalPayload || payload.canonical_payload),
    sourceLinks: normalizeSourceLinks(payload.sourceLinks || payload.source_links),
    materializationHints: normalizeMaterializationHints(payload.materializationHints || payload.materialization_hints),
    traceId: typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null,
    recordEnvelope: envelope
  };
}

module.exports = {
  DEFAULT_CANONICAL_CORE_OUTBOX_CONTRACT_VERSION,
  isCanonicalCoreOutboxDualWriteEnabled,
  isCanonicalCoreOutboxStrictEnabled,
  buildCanonicalCoreOutboxEvent
};
