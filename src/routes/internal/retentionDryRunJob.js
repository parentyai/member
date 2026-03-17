'use strict';

const { getDb } = require('../../infra/firestore');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getRetentionPolicy } = require('../../domain/retention/retentionPolicy');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const DEFAULT_SAMPLE_LIMIT = 200;
const ROUTE_KEY = 'internal_retention_dry_run_job';

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

function normalizeSampleLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_SAMPLE_LIMIT;
  return Math.min(Math.floor(num), 1000);
}

async function countCandidates(db, collection, sampleLimit) {
  const policy = getRetentionPolicy(collection);
  const snap = await db.collection(collection).limit(sampleLimit).get();
  return {
    collection,
    policy,
    sampleLimit,
    sampledDocs: snap.docs.length,
    deleteCandidates: 0
  };
}

async function handleRetentionDryRunJob(req, res, bodyText, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getDbFn = resolvedDeps.getDb || getDb;
  const appendAuditLogFn = resolvedDeps.appendAuditLog || appendAuditLog;
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not_found' }, {
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

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' }, {
      state: 'error',
      reason: 'invalid_json',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  const collections = normalizeCollections(payload.collections);
  if (!collections.length) {
    writeJson(res, 400, { ok: false, error: 'collections required' }, {
      state: 'error',
      reason: 'collections_required',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const traceId = req.headers && typeof req.headers['x-trace-id'] === 'string' && req.headers['x-trace-id'].trim()
    ? req.headers['x-trace-id'].trim()
    : null;
  const sampleLimit = normalizeSampleLimit(payload.sampleLimit);
  const db = getDbFn();

  const results = [];
  for (const collection of collections) {
    const row = await countCandidates(db, collection, sampleLimit);
    results.push(row);
  }

  const summary = {
    collections: results.length,
    sampledDocs: results.reduce((acc, row) => acc + row.sampledDocs, 0),
    deleteCandidates: 0,
    dryRun: true,
    undefinedCollections: results.filter((row) => !row.policy || row.policy.defined === false).map((row) => row.collection)
  };
  const hasUndefinedCollections = summary.undefinedCollections.length > 0;

  try {
    await appendAuditLogFn({
      actor: 'retention_dry_run_job',
      action: hasUndefinedCollections ? 'retention.dry_run.blocked' : 'retention.dry_run.execute',
      entityType: 'retention_policy',
      entityId: 'global',
      traceId: traceId || undefined,
      payloadSummary: {
        dryRun: true,
        sampleLimit,
        collections,
        summary
      }
    });
  } catch (_err) {
    // best-effort
  }

  if (hasUndefinedCollections) {
    writeJson(res, 422, {
      ok: false,
      error: 'retention_policy_undefined',
      dryRun: true,
      traceId,
      summary,
      items: results
    }, {
      state: 'blocked',
      reason: 'retention_policy_undefined',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  writeJson(res, 200, {
    ok: true,
    dryRun: true,
    traceId,
    summary,
    items: results
  }, {
    state: 'success',
    reason: 'dry_run',
    guard: { routeKey: ROUTE_KEY, decision: 'allow' }
  });
}

module.exports = {
  handleRetentionDryRunJob
};
