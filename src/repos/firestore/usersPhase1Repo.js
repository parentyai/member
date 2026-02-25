'use strict';

const { getDb } = require('../../infra/firestore');
const { normalizeScenarioKey } = require('../../domain/normalizers/scenarioKeyNormalizer');

const COLLECTION = 'users';

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortUsersByCreatedAtDesc(rows) {
  return (rows || []).slice().sort((a, b) => toMillis(b && b.createdAt) - toMillis(a && a.createdAt));
}

function mergeUsers(canonicalRows, legacyRows) {
  const merged = [];
  const seen = new Set();
  for (const row of [].concat(canonicalRows || [], legacyRows || [])) {
    if (!row || !row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return sortUsersByCreatedAtDesc(merged);
}

async function listUsersByScenario(scenario, limit) {
  const normalizedScenarioKey = normalizeScenarioKey({ scenarioKey: scenario, scenario });
  if (!normalizedScenarioKey) throw new Error('scenario required');
  const db = getDb();
  const max = typeof limit === 'number' ? limit : 500;

  // Canonical path: scenarioKey first.
  let canonicalQuery = db.collection(COLLECTION).where('scenarioKey', '==', normalizedScenarioKey).orderBy('createdAt', 'desc');
  if (max) canonicalQuery = canonicalQuery.limit(max);
  const canonicalSnap = await canonicalQuery.get();
  const canonicalRows = canonicalSnap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));

  // Legacy fallback: scenario (read-only compatibility for unmigrated user docs).
  let legacyQuery = db.collection(COLLECTION).where('scenario', '==', normalizedScenarioKey).orderBy('createdAt', 'desc');
  if (max) legacyQuery = legacyQuery.limit(max);
  const legacySnap = await legacyQuery.get();
  const legacyRows = legacySnap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  const merged = mergeUsers(canonicalRows, legacyRows);
  return max ? merged.slice(0, max) : merged;
}

module.exports = {
  listUsersByScenario
};
