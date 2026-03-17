'use strict';

const { getDb } = require('../../infra/firestore');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { listAuditLogsByTraceId } = require('../../repos/firestore/auditLogsRepo');
const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getRetentionPolicy } = require('../../domain/retention/retentionPolicy');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const ROUTE_KEY = 'internal_retention_apply_job';

function writeJson(res, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, Object.assign({
    routeType: 'internal_job',
    guard: { routeKey: ROUTE_KEY }
  }, outcomeOptions || {}));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseJson(bodyText) {
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_err) {
    return null;
  }
}

function normalizeCollections(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(num), MAX_LIMIT);
}

function normalizeMaxDeletes(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return normalizeLimit(fallback);
  return Math.min(Math.floor(num), MAX_LIMIT);
}

function resolveTraceId(req) {
  const value = req && req.headers && typeof req.headers['x-trace-id'] === 'string' ? req.headers['x-trace-id'].trim() : '';
  return value || null;
}

function resolveEnvName() {
  const value = process.env.ENV_NAME;
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isApplyEnabled() {
  const value = process.env.RETENTION_APPLY_ENABLED;
  return value === '1' || value === 'true';
}

function isAllowedEnvironment() {
  const envName = resolveEnvName();
  return envName === 'stg' || envName === 'stage' || envName === 'staging';
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  }
  if (value && Number.isFinite(value._seconds)) return Number(value._seconds) * 1000;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  return 0;
}

function parseCutoff(payload) {
  const value = payload && typeof payload.cutoffIso === 'string' ? payload.cutoffIso.trim() : '';
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return ms;
}

function parseOptionalTraceId(payload, fieldName) {
  const value = payload && typeof payload[fieldName] === 'string' ? payload[fieldName].trim() : '';
  return value || null;
}

function normalizeCursorMap(value, collections) {
  const map = {};
  if (typeof value === 'string' && value.trim()) {
    const cursor = value.trim();
    (collections || []).forEach((collection) => {
      map[collection] = cursor;
    });
    return map;
  }
  if (!value || typeof value !== 'object') return map;
  (collections || []).forEach((collection) => {
    if (typeof value[collection] === 'string' && value[collection].trim()) {
      map[collection] = value[collection].trim();
    }
  });
  return map;
}

function isCollectionApplyEligible(policy) {
  if (!policy || policy.defined !== true) return false;
  if (policy.deletable === 'NO') return false;
  if (policy.recomputable !== true) return false;
  return true;
}

async function applyCollection(db, collection, cutoffMs, limit, maxDeletes, cursor) {
  const snap = await db.collection(collection).limit(limit).get();
  const docs = (snap.docs || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const cursorValue = typeof cursor === 'string' && cursor.trim() ? cursor.trim() : null;
  const docsAfterCursor = cursorValue
    ? docs.filter((doc) => String(doc.id) > cursorValue)
    : docs;
  const candidates = docsAfterCursor.filter((doc) => {
    const data = doc.data() || {};
    const createdAtMs = toMillis(data.createdAt);
    return createdAtMs > 0 && createdAtMs < cutoffMs;
  });
  const bounded = candidates.slice(0, Math.max(0, maxDeletes));
  for (const doc of bounded) {
    await db.collection(collection).doc(doc.id).delete();
  }
  const nextCursor = bounded.length
    ? bounded[bounded.length - 1].id
    : (docsAfterCursor.length ? docsAfterCursor[docsAfterCursor.length - 1].id : cursorValue);
  return {
    collection,
    sampledDocs: docsAfterCursor.length,
    deleteCandidates: candidates.length,
    deletedIds: bounded.map((doc) => doc.id),
    hasMore: candidates.length > bounded.length,
    nextCursor: nextCursor || null
  };
}

async function verifyDryRunTrace(traceId) {
  if (!traceId) return { ok: true, reason: null };
  const rows = await listAuditLogsByTraceId(traceId, 200);
  const found = rows.some((row) => row && row.action === 'retention.dry_run.execute');
  if (found) return { ok: true, reason: null };
  return { ok: false, reason: 'retention_apply_dry_run_trace_not_found' };
}

async function handleRetentionApplyJob(req, res, bodyText, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getDbFn = resolvedDeps.getDb || getDb;
  const appendAuditLogFn = resolvedDeps.appendAuditLog || appendAuditLog;
  const verifyDryRunTraceFn = resolvedDeps.verifyDryRunTrace || verifyDryRunTrace;
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  if (!requireInternalJobToken(req, res, {
    routeType: 'internal_job',
    guard: { routeKey: ROUTE_KEY }
  })) return;

  const traceId = resolveTraceId(req);
  if (!isApplyEnabled()) {
    writeJson(res, 409, { ok: false, error: 'retention apply disabled', traceId }, {
      state: 'blocked',
      reason: 'retention_apply_disabled',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  if (!isAllowedEnvironment()) {
    writeJson(res, 409, { ok: false, error: 'retention apply not allowed in env', traceId }, {
      state: 'blocked',
      reason: 'retention_apply_env_not_allowed',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json', traceId }, {
      state: 'error',
      reason: 'invalid_json',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  const collections = normalizeCollections(payload.collections);
  if (!collections.length) {
    writeJson(res, 400, { ok: false, error: 'collections required', traceId }, {
      state: 'error',
      reason: 'collections_required',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  const cutoffMs = parseCutoff(payload);
  if (!cutoffMs) {
    writeJson(res, 422, { ok: false, error: 'cutoffIso required', traceId }, {
      state: 'error',
      reason: 'cutoff_iso_required',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const dryRunTraceId = parseOptionalTraceId(payload, 'dryRunTraceId');
  const dryRunTraceCheck = await verifyDryRunTraceFn(dryRunTraceId);
  if (!dryRunTraceCheck.ok) {
    writeJson(res, 422, { ok: false, error: dryRunTraceCheck.reason, traceId, dryRunTraceId }, {
      state: 'blocked',
      reason: dryRunTraceCheck.reason,
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const undefinedCollections = [];
  const blockedCollections = [];
  const targets = [];
  for (const collection of collections) {
    const policy = getRetentionPolicy(collection);
    if (!policy || policy.defined !== true) {
      undefinedCollections.push(collection);
      continue;
    }
    if (!isCollectionApplyEligible(policy)) {
      blockedCollections.push({
        collection,
        reason: 'policy_not_deletable_or_not_recomputable',
        policy
      });
      continue;
    }
    targets.push({ collection, policy });
  }

  const db = getDbFn();
  const limit = normalizeLimit(payload.limit);
  const maxDeletes = normalizeMaxDeletes(payload.maxDeletes, limit);
  const cursorMap = normalizeCursorMap(payload.cursor, collections);
  const items = [];
  const nextCursor = {};
  let remainingDeletes = maxDeletes;
  for (const target of targets) {
    if (remainingDeletes <= 0) break;
    const row = await applyCollection(
      db,
      target.collection,
      cutoffMs,
      limit,
      remainingDeletes,
      cursorMap[target.collection]
    );
    items.push(Object.assign({}, row, {
      policy: target.policy,
      deletedCount: row.deletedIds.length,
      sampleDeletedIds: row.deletedIds.slice(0, 20)
    }));
    nextCursor[target.collection] = row.nextCursor;
    remainingDeletes -= row.deletedIds.length;
  }

  const summary = {
    collectionsRequested: collections.length,
    collectionsApplied: items.length,
    undefinedCollections,
    blockedCollections,
    deletedCount: items.reduce((sum, row) => sum + row.deletedCount, 0),
    limit,
    maxDeletes,
    remainingDeletes,
    cutoffIso: new Date(cutoffMs).toISOString()
  };

  const hasUndefined = undefinedCollections.length > 0;
  const hasNoTargets = items.length === 0;

  try {
    await appendAuditLogFn({
      actor: 'retention_apply_job',
      action: hasUndefined || hasNoTargets ? 'retention.apply.blocked' : 'retention.apply.execute',
      entityType: 'retention_policy',
      entityId: 'global',
      traceId: traceId || undefined,
      payloadSummary: {
        collections,
        dryRunTraceId,
        summary,
        deletedSamples: items.map((row) => ({ collection: row.collection, ids: row.sampleDeletedIds }))
      }
    });
  } catch (_err) {
    // best-effort
  }

  if (hasUndefined) {
    writeJson(res, 422, {
      ok: false,
      error: 'retention_policy_undefined',
      traceId,
      summary,
      items
    }, {
      state: 'blocked',
      reason: 'retention_policy_undefined',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  if (hasNoTargets) {
    writeJson(res, 409, {
      ok: false,
      error: 'retention_apply_no_eligible_collections',
      traceId,
      summary,
      items
    }, {
      state: 'blocked',
      reason: 'retention_apply_no_eligible_collections',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  writeJson(res, 200, {
    ok: true,
    traceId,
    dryRunTraceId,
    summary,
    items,
    nextCursor,
    hasMore: items.some((row) => row.hasMore === true)
  }, {
    state: items.some((row) => row.hasMore === true) ? 'partial' : 'success',
    reason: items.some((row) => row.hasMore === true) ? 'completed_with_more_remaining' : 'completed',
    guard: { routeKey: ROUTE_KEY, decision: 'allow' }
  });
}

module.exports = {
  handleRetentionApplyJob
};
