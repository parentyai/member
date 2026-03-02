'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { normalizeOpsStateRecord } = require('../../domain/normalizers/opsStateNormalizer');

const DEFAULT_SCAN_LIMIT = 500;
const MAX_SCAN_LIMIT = 5000;
const FIELD_SCN = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111);
const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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

function normalizeResumeAfterUserId(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function resolveCanonicalKey(input) {
  const payload = input && typeof input === 'object' ? input : {};
  return normalizeString(payload[FIELD_SCK]) || normalizeString(payload[FIELD_SCN]) || null;
}

function detectCanonicalDrift(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const canonical = normalizeString(payload[FIELD_SCK]);
  const legacy = normalizeString(payload[FIELD_SCN]);
  return Boolean(canonical && legacy && canonical !== legacy);
}

async function listUsersForScan(db) {
  const snap = await db.collection('users').get();
  return snap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function collectScenarioDriftCandidates(users) {
  const candidates = [];
  for (const user of users) {
    const data = user.data || {};
    const normalized = resolveCanonicalKey(data);
    if (!normalized) continue;
    const hasCanonical = normalizeString(data[FIELD_SCK]);
    if (!hasCanonical || detectCanonicalDrift(data)) {
      candidates.push({
        id: user.id,
        legacyKey: normalizeString(data[FIELD_SCN]),
        canonicalKey: normalizeString(data[FIELD_SCK]),
        normalizedCanonicalKey: normalized
      });
    }
  }
  return candidates;
}

async function applyScenarioBackfill(db, candidates) {
  let applied = 0;
  for (const candidate of candidates) {
    await db.collection('users').doc(candidate.id).set({
      [FIELD_SCK]: candidate.normalizedCanonicalKey,
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

async function runStructDriftBackfill(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const db = payload.db || getDb();
  const dryRun = normalizeDryRun(payload);
  const scanLimit = normalizeScanLimit(payload.scanLimit);
  const resumeAfterUserId = normalizeResumeAfterUserId(payload.resumeAfterUserId);

  const users = await listUsersForScan(db);
  const offset = resumeAfterUserId
    ? users.findIndex((user) => user.id === resumeAfterUserId) + 1
    : 0;
  const normalizedOffset = Math.max(0, offset);
  const remaining = users.slice(normalizedOffset);
  const scannedUsers = remaining.slice(0, scanLimit);

  const scenarioCandidates = collectScenarioDriftCandidates(scannedUsers);
  const opsStateCandidate = await collectOpsStateDrift(db);

  let scenarioApplied = 0;
  let opsStateApplied = false;
  if (!dryRun) {
    scenarioApplied = await applyScenarioBackfill(db, scenarioCandidates);
    opsStateApplied = await applyOpsStateBackfill(db, opsStateCandidate);
  }

  const hasMore = remaining.length > scannedUsers.length;
  const nextResumeAfterUserId = scannedUsers.length ? scannedUsers[scannedUsers.length - 1].id : null;
  const changedCount = scenarioApplied + (opsStateApplied ? 1 : 0);

  const summary = {
    dryRun,
    mode: dryRun ? 'dry-run' : 'apply',
    scanLimit,
    resumeAfterUserId,
    scannedUsers: scannedUsers.length,
    scenarioDriftCandidates: scenarioCandidates.length,
    scenarioBackfilled: scenarioApplied,
    opsStateDriftCandidate: Boolean(opsStateCandidate),
    opsStateBackfilled: Boolean(opsStateApplied),
    changedCount,
    hasMore,
    nextResumeAfterUserId: hasMore ? nextResumeAfterUserId : null
  };

  return {
    ok: true,
    summary,
    scenarioCandidates,
    opsStateCandidate: opsStateCandidate ? {
      targetCollection: opsStateCandidate.targetCollection,
      targetDocId: opsStateCandidate.targetDocId,
      fromCollection: opsStateCandidate.fromCollection,
      fromDocId: opsStateCandidate.fromDocId
    } : null
  };
}

module.exports = {
  runStructDriftBackfill,
  normalizeScanLimit,
  normalizeDryRun
};
