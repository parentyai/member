'use strict';

const { getDb } = require('../../infra/firestore');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireInternalJobToken } = require('./cityPackSourceAuditJob');

const DEFAULT_SAMPLE_LIMIT = 200;

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
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
  const snap = await db.collection(collection).limit(sampleLimit).get();
  return {
    collection,
    sampleLimit,
    sampledDocs: snap.docs.length,
    deleteCandidates: 0
  };
}

async function handleRetentionDryRunJob(req, res, bodyText) {
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireInternalJobToken(req, res)) return;

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' });
    return;
  }
  const collections = normalizeCollections(payload.collections);
  if (!collections.length) {
    writeJson(res, 400, { ok: false, error: 'collections required' });
    return;
  }

  const traceId = req.headers && typeof req.headers['x-trace-id'] === 'string' && req.headers['x-trace-id'].trim()
    ? req.headers['x-trace-id'].trim()
    : null;
  const sampleLimit = normalizeSampleLimit(payload.sampleLimit);
  const db = getDb();

  const results = [];
  for (const collection of collections) {
    const row = await countCandidates(db, collection, sampleLimit);
    results.push(row);
  }

  const summary = {
    collections: results.length,
    sampledDocs: results.reduce((acc, row) => acc + row.sampledDocs, 0),
    deleteCandidates: 0,
    dryRun: true
  };

  try {
    await appendAuditLog({
      actor: 'retention_dry_run_job',
      action: 'retention.dry_run.execute',
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

  writeJson(res, 200, {
    ok: true,
    dryRun: true,
    traceId,
    summary,
    items: results
  });
}

module.exports = {
  handleRetentionDryRunJob
};
