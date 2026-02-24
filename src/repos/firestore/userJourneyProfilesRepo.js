'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'user_journey_profiles';
const IN_QUERY_CHUNK_SIZE = 10;
const ALLOWED_HOUSEHOLD_TYPES = Object.freeze(['single', 'couple', 'accompany1', 'accompany2']);
const ALLOWED_SCENARIO_KEYS = Object.freeze(['A', 'B', 'C', 'D']);

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeString(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeHouseholdType(value, fallback) {
  const normalized = normalizeString(value, fallback);
  if (normalized === null || normalized === '') return null;
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_HOUSEHOLD_TYPES.includes(lowered)) return null;
  return lowered;
}

function normalizeScenarioKeyMirror(value, fallback) {
  const normalized = normalizeString(value, fallback);
  if (normalized === null || normalized === '') return null;
  const upper = normalized.toUpperCase();
  if (!ALLOWED_SCENARIO_KEYS.includes(upper)) return null;
  return upper;
}

function normalizeProfile(lineUserId, input) {
  const payload = input && typeof input === 'object' ? input : {};
  return {
    lineUserId: normalizeLineUserId(lineUserId),
    householdType: normalizeHouseholdType(payload.householdType, null),
    scenarioKeyMirror: normalizeScenarioKeyMirror(payload.scenarioKeyMirror, null),
    timezone: normalizeString(payload.timezone, null),
    locale: normalizeString(payload.locale, 'ja-JP'),
    updatedAt: payload.updatedAt || null,
    updatedBy: normalizeString(payload.updatedBy, null),
    source: normalizeString(payload.source, null)
  };
}

function chunkList(list, size) {
  const out = [];
  const chunkSize = Math.max(1, Number(size) || IN_QUERY_CHUNK_SIZE);
  for (let i = 0; i < list.length; i += chunkSize) {
    out.push(list.slice(i, i + chunkSize));
  }
  return out;
}

async function getUserJourneyProfile(lineUserId) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeProfile(id, snap.data());
}

async function upsertUserJourneyProfile(lineUserId, patch, actor) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) throw new Error('lineUserId required');
  const payload = patch && typeof patch === 'object' ? patch : {};
  const normalized = normalizeProfile(id, payload);
  if (normalized.householdType === null && payload.householdType !== undefined && payload.householdType !== null && payload.householdType !== '') {
    throw new Error('invalid householdType');
  }
  if (normalized.scenarioKeyMirror === null && payload.scenarioKeyMirror !== undefined && payload.scenarioKeyMirror !== null && payload.scenarioKeyMirror !== '') {
    throw new Error('invalid scenarioKeyMirror');
  }
  const updatedBy = normalizeString(actor, normalized.updatedBy || 'unknown') || 'unknown';
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    updatedAt: payload.updatedAt || serverTimestamp(),
    updatedBy
  }), { merge: true });
  return getUserJourneyProfile(id);
}

async function listUserJourneyProfilesByLineUserIds(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserIds = Array.from(new Set((Array.isArray(payload.lineUserIds) ? payload.lineUserIds : [])
    .map((id) => normalizeLineUserId(id))
    .filter(Boolean)));
  if (!lineUserIds.length) return [];
  const db = getDb();
  const rows = [];
  for (const chunk of chunkList(lineUserIds, IN_QUERY_CHUNK_SIZE)) {
    const docs = await Promise.all(chunk.map(async (lineUserId) => {
      const snap = await db.collection(COLLECTION).doc(lineUserId).get();
      if (!snap.exists) return null;
      return normalizeProfile(lineUserId, snap.data());
    }));
    docs.filter(Boolean).forEach((row) => rows.push(row));
  }
  return rows;
}

module.exports = {
  COLLECTION,
  ALLOWED_HOUSEHOLD_TYPES,
  ALLOWED_SCENARIO_KEYS,
  normalizeProfile,
  getUserJourneyProfile,
  upsertUserJourneyProfile,
  listUserJourneyProfilesByLineUserIds
};
