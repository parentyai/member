'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { ALLOWED_MODULES } = require('./cityPacksRepo');

const COLLECTION = 'user_city_pack_preferences';
const ALLOWED_MODULE_SET = new Set(ALLOWED_MODULES);
const BULK_READ_CHUNK_SIZE = 100;

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeModules(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((value) => {
    if (typeof value !== 'string') return;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    if (!ALLOWED_MODULE_SET.has(normalized)) return;
    if (out.includes(normalized)) return;
    out.push(normalized);
  });
  return out;
}

function normalizePreference(lineUserId, input) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) return null;
  const payload = input && typeof input === 'object' ? input : {};
  return {
    lineUserId: id,
    modulesSubscribed: normalizeModules(payload.modulesSubscribed),
    updatedAt: payload.updatedAt || null,
    updatedBy: normalizeText(payload.updatedBy, null),
    source: normalizeText(payload.source, null)
  };
}

async function getUserCityPackPreference(lineUserId) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizePreference(id, snap.data());
}

async function upsertUserCityPackPreference(lineUserId, patch, actor) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) throw new Error('lineUserId required');
  const existing = await getUserCityPackPreference(id);
  const normalized = normalizePreference(id, Object.assign({}, existing || {}, patch || {}));
  if (!normalized) throw new Error('invalid user city pack preference');
  const updatedBy = normalizeText(actor, normalized.updatedBy || 'unknown') || 'unknown';
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp(),
    updatedBy
  }), { merge: true });
  return getUserCityPackPreference(id);
}

async function listUserCityPackPreferencesByLineUserIds(lineUserIds) {
  const ids = Array.from(new Set((Array.isArray(lineUserIds) ? lineUserIds : [])
    .map((value) => normalizeLineUserId(value))
    .filter(Boolean)));
  if (!ids.length) return [];
  const db = getDb();

  const refs = ids.map((lineUserId) => db.collection(COLLECTION).doc(lineUserId));
  const snaps = [];
  for (let offset = 0; offset < refs.length; offset += BULK_READ_CHUNK_SIZE) {
    const chunkRefs = refs.slice(offset, offset + BULK_READ_CHUNK_SIZE);
    if (typeof db.getAll === 'function') {
      // Firestore native batch fetch path.
      // eslint-disable-next-line no-await-in-loop
      const chunkSnaps = await db.getAll(...chunkRefs);
      snaps.push(...chunkSnaps);
      continue;
    }
    // Fallback path for stubs and environments without db.getAll.
    // eslint-disable-next-line no-await-in-loop
    const chunkSnaps = await Promise.all(chunkRefs.map((ref) => ref.get()));
    snaps.push(...chunkSnaps);
  }

  const rows = [];
  snaps.forEach((snap, index) => {
    if (!snap || !snap.exists) return;
    const lineUserId = normalizeLineUserId(snap.id || ids[index]);
    if (!lineUserId) return;
    rows.push(normalizePreference(lineUserId, snap.data()));
  });
  return rows.filter(Boolean);
}

module.exports = {
  COLLECTION,
  ALLOWED_MODULES,
  normalizeModules,
  normalizePreference,
  getUserCityPackPreference,
  upsertUserCityPackPreference,
  listUserCityPackPreferencesByLineUserIds
};
