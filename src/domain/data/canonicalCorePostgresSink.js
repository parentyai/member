'use strict';

const {
  materializeCanonicalCoreTypedTables,
  isCanonicalCoreTypedMaterializerEnabled,
  isCanonicalCoreTypedMaterializerStrictEnabled
} = require('./canonicalCoreTypedMaterializer');

let poolCache = null;

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return defaultValue === true;
}

function isCanonicalCorePostgresSinkEnabled() {
  return resolveBooleanEnvFlag('ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1', false);
}

function isCanonicalCorePostgresSinkStrictEnabled() {
  return resolveBooleanEnvFlag('ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1', false);
}

function resolveCanonicalCorePostgresDsn() {
  const value = process.env.CANONICAL_CORE_POSTGRES_DSN;
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function resolvePoolFactory(deps) {
  if (deps && typeof deps.createPool === 'function') return deps.createPool;
  return function createPoolWithPg(options) {
    // Optional runtime dependency: do not force-load unless sink is enabled.
    const pg = require('pg'); // eslint-disable-line global-require
    return new pg.Pool(options);
  };
}

function resolvePool(deps) {
  if (deps && deps.pool) return deps.pool;
  if (poolCache) return poolCache;
  const dsn = resolveCanonicalCorePostgresDsn();
  if (!dsn) throw new Error('CANONICAL_CORE_POSTGRES_DSN not configured');
  const createPool = resolvePoolFactory(deps);
  poolCache = createPool({ connectionString: dsn, max: 5 });
  return poolCache;
}

function normalizeEvent(params) {
  const payload = params && typeof params === 'object' ? params : {};
  return {
    objectType: typeof payload.objectType === 'string' && payload.objectType.trim()
      ? payload.objectType.trim().toLowerCase()
      : 'unknown_object',
    objectId: typeof payload.objectId === 'string' && payload.objectId.trim()
      ? payload.objectId.trim()
      : 'unknown_object_id',
    eventType: typeof payload.eventType === 'string' && payload.eventType.trim()
      ? payload.eventType.trim().toLowerCase()
      : 'upsert',
    sourceSystem: typeof payload.sourceSystem === 'string' && payload.sourceSystem.trim()
      ? payload.sourceSystem.trim()
      : 'member_firestore',
    sourceSnapshotRef: typeof payload.sourceSnapshotRef === 'string' && payload.sourceSnapshotRef.trim()
      ? payload.sourceSnapshotRef.trim()
      : 'snapshot:unknown',
    effectiveFrom: payload.effectiveFrom || null,
    effectiveTo: payload.effectiveTo || null,
    authorityTier: payload.authorityTier || 'UNKNOWN',
    bindingLevel: payload.bindingLevel || 'UNKNOWN',
    jurisdiction: payload.jurisdiction || null,
    payloadSummary: payload.payloadSummary && typeof payload.payloadSummary === 'object'
      ? payload.payloadSummary
      : {},
    canonicalPayload: payload.canonicalPayload && typeof payload.canonicalPayload === 'object'
      ? payload.canonicalPayload
      : {},
    materializationHints: payload.materializationHints && typeof payload.materializationHints === 'object'
      ? payload.materializationHints
      : {},
    recordEnvelope: payload.recordEnvelope && typeof payload.recordEnvelope === 'object'
      ? payload.recordEnvelope
      : {},
    traceId: typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null
  };
}

async function upsertCanonicalCoreObject(event, deps) {
  if (!isCanonicalCorePostgresSinkEnabled()) {
    return { skipped: true, reason: 'postgres_sink_disabled', strict: isCanonicalCorePostgresSinkStrictEnabled() };
  }
  const strict = isCanonicalCorePostgresSinkStrictEnabled();
  const payload = normalizeEvent(event);
  const sql = `
INSERT INTO canonical_core_objects (
  object_type,
  object_id,
  event_type,
  source_system,
  source_snapshot_ref,
  effective_from,
  effective_to,
  authority_tier,
  binding_level,
  jurisdiction,
  payload_summary,
  record_envelope,
  trace_id,
  created_at,
  updated_at
)
VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,NOW(),NOW()
)
ON CONFLICT (object_type, object_id) DO UPDATE
SET
  event_type = EXCLUDED.event_type,
  source_system = EXCLUDED.source_system,
  source_snapshot_ref = EXCLUDED.source_snapshot_ref,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  authority_tier = EXCLUDED.authority_tier,
  binding_level = EXCLUDED.binding_level,
  jurisdiction = EXCLUDED.jurisdiction,
  payload_summary = EXCLUDED.payload_summary,
  record_envelope = EXCLUDED.record_envelope,
  trace_id = EXCLUDED.trace_id,
  updated_at = NOW()
RETURNING object_type, object_id
`.trim();
  const values = [
    payload.objectType,
    payload.objectId,
    payload.eventType,
    payload.sourceSystem,
    payload.sourceSnapshotRef,
    payload.effectiveFrom,
    payload.effectiveTo,
    payload.authorityTier,
    payload.bindingLevel,
    payload.jurisdiction,
    JSON.stringify(payload.payloadSummary),
    JSON.stringify(payload.recordEnvelope),
    payload.traceId
  ];

  try {
    const pool = resolvePool(deps);
    const result = await pool.query(sql, values);
    const row = Array.isArray(result && result.rows) ? result.rows[0] : null;
    const canonicalRecordId = row && row.object_type && row.object_id
      ? `${row.object_type}:${row.object_id}`
      : `${payload.objectType}:${payload.objectId}`;
    const typedMaterialization = await materializeCanonicalCoreTypedTables(payload, Object.assign({}, deps, { pool }));
    return {
      skipped: false,
      canonicalRecordId,
      typedMaterialization
    };
  } catch (error) {
    if (strict) throw error;
    return {
      skipped: true,
      reason: 'postgres_sink_failed',
      strict,
      errorCode: error && error.code ? String(error.code) : 'postgres_sink_failed'
    };
  }
}

module.exports = {
  isCanonicalCorePostgresSinkEnabled,
  isCanonicalCorePostgresSinkStrictEnabled,
  isCanonicalCoreTypedMaterializerEnabled,
  isCanonicalCoreTypedMaterializerStrictEnabled,
  resolveCanonicalCorePostgresDsn,
  upsertCanonicalCoreObject
};
