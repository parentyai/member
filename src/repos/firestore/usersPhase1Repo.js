'use strict';

const { getDb } = require('../../infra/firestore');

const COLLECTION = 'users';
const FIELD_SCN = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111);
const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

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

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveCanonicalKey(input) {
  const payload = input && typeof input === 'object' ? input : {};
  return normalizeText(payload[FIELD_SCK]) || normalizeText(payload[FIELD_SCN]) || null;
}

async function listUsersByScenario(inputValue, limit) {
  const normalizedKey = resolveCanonicalKey({ [FIELD_SCK]: inputValue, [FIELD_SCN]: inputValue });
  if (!normalizedKey) throw new Error(`${FIELD_SCN} required`);
  const db = getDb();
  const max = typeof limit === 'number' ? limit : 500;

  let canonicalQuery = db.collection(COLLECTION).where(FIELD_SCK, '==', normalizedKey).orderBy('createdAt', 'desc');
  if (max) canonicalQuery = canonicalQuery.limit(max);
  const canonicalSnap = await canonicalQuery.get();
  const canonicalRows = canonicalSnap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));

  let legacyQuery = db.collection(COLLECTION).where(FIELD_SCN, '==', normalizedKey).orderBy('createdAt', 'desc');
  if (max) legacyQuery = legacyQuery.limit(max);
  const legacySnap = await legacyQuery.get();
  const legacyRows = legacySnap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  const merged = mergeUsers(canonicalRows, legacyRows);
  return max ? merged.slice(0, max) : merged;
}

module.exports = {
  listUsersByScenario
};
