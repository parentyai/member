'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { normalizeScenarioKey, detectScenarioDrift } = require('../../domain/normalizers/scenarioKeyNormalizer');
const { normalizeOpsStateRecord } = require('../../domain/normalizers/opsStateNormalizer');
const { requireInternalJobToken } = require('./cityPackSourceAuditJob');

const DEFAULT_SCAN_LIMIT = 500;
const MAX_SCAN_LIMIT = 5000;

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

function resolveTraceId(req, payload) {
  const headerTraceId = req && req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : '';
  if (headerTraceId) return headerTraceId;
  if (payload && typeof payload.traceId === 'string' && payload.traceId.trim()) return payload.traceId.trim();
  return null;
}

function normalizeScanLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_SCAN_LIMIT;
  return Math.min(Math.floor(num), MAX_SCAN_LIMIT);
}

function normalizeDryRun(payload) {
  if (!payload || typeof payload !== 'object') return true;
  if (payload.apply === true) return false;
  if (payload.dryRun === false) return false;
  return true;
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function collectScenarioDriftCandidates(db, scanLimit) {
  const snap = await db.collection('users').limit(scanLimit).get();
  const candidates = [];
  snap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const normalized = normalizeScenarioKey({
      scenarioKey: data.scenarioKey,
      scenario: data.scenario
    });
    if (!normalized) return;
    const hasCanonical = normalizeString(data.scenarioKey);
    if (!hasCanonical || detectScenarioDrift(data)) {
      candidates.push({
        id: doc.id,
        scenario: normalizeString(data.scenario),
        scenarioKey: normalizeString(data.scenarioKey),
        normalizedScenarioKey: normalized
      });
    }
  });
  return candidates;
}

async function applyScenarioBackfill(db, candidates) {
  let applied = 0;
  for (const candidate of candidates) {
    await db.collection('users').doc(candidate.id).set({
      scenarioKey: candidate.normalizedScenarioKey,
      updatedAt: serverTimestamp()
    }, { merge: true });
    applied += 1;
  }
  return applied;
}

async function collectOpsStateDrift(db) {
  const legacySnap = await db.collection('ops_state').doc('global').get();
  const canonicalSnap = await db.collection('ops_states').doc('global').get();
  if (!legacySnap.exists) return null;
  const legacyNormalized = normalizeOpsStateRecord(legacySnap.data() || {});
  const canonicalData = canonicalSnap.exists ? (canonicalSnap.data() || {}) : {};

  const patch = {};
  if (!canonicalData.lastReviewedAt && legacyNormalized.lastReviewedAt) patch.lastReviewedAt = legacyNormalized.lastReviewedAt;
  if (!canonicalData.lastReviewedBy && legacyNormalized.lastReviewedBy) patch.lastReviewedBy = legacyNormalized.lastReviewedBy;
  if (!Object.keys(patch).length) return null;
  patch.updatedAt = serverTimestamp();

  return {
    targetCollection: 'ops_states',
    targetDocId: 'global',
    fromCollection: 'ops_state',
    fromDocId: 'global',
    patch
  };
}

async function applyOpsStateBackfill(db, candidate) {
  if (!candidate) return false;
  await db.collection(candidate.targetCollection).doc(candidate.targetDocId).set(candidate.patch, { merge: true });
  return true;
}

async function handleStructDriftBackfillJob(req, res, bodyText) {
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

  const dryRun = normalizeDryRun(payload);
  const scanLimit = normalizeScanLimit(payload.scanLimit);
  const traceId = resolveTraceId(req, payload);
  const db = getDb();

  const scenarioCandidates = await collectScenarioDriftCandidates(db, scanLimit);
  const opsStateCandidate = await collectOpsStateDrift(db);

  let scenarioApplied = 0;
  let opsStateApplied = false;
  if (!dryRun) {
    scenarioApplied = await applyScenarioBackfill(db, scenarioCandidates);
    opsStateApplied = await applyOpsStateBackfill(db, opsStateCandidate);
  }

  const summary = {
    dryRun,
    scanLimit,
    scenarioDriftCandidates: scenarioCandidates.length,
    scenarioBackfilled: scenarioApplied,
    opsStateDriftCandidate: Boolean(opsStateCandidate),
    opsStateBackfilled: Boolean(opsStateApplied)
  };

  try {
    await appendAuditLog({
      actor: 'struct_drift_backfill_job',
      action: 'struct_drift.backfill.execute',
      entityType: 'struct_drift',
      entityId: 'global',
      traceId: traceId || undefined,
      payloadSummary: {
        dryRun,
        scanLimit,
        summary,
        scenarioCandidateIds: scenarioCandidates.map((row) => row.id).slice(0, 50),
        opsStateCandidate: opsStateCandidate ? {
          targetCollection: opsStateCandidate.targetCollection,
          targetDocId: opsStateCandidate.targetDocId
        } : null
      }
    });
  } catch (_err) {
    // best-effort audit
  }

  writeJson(res, 200, {
    ok: true,
    traceId,
    summary,
    scenarioCandidates,
    opsStateCandidate: opsStateCandidate ? {
      targetCollection: opsStateCandidate.targetCollection,
      targetDocId: opsStateCandidate.targetDocId,
      fromCollection: opsStateCandidate.fromCollection,
      fromDocId: opsStateCandidate.fromDocId
    } : null
  });
}

module.exports = {
  handleStructDriftBackfillJob
};
