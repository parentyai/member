'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'user_journey_schedules';
const IN_QUERY_CHUNK_SIZE = 10;
const ALLOWED_STAGES = Object.freeze([
  'unspecified',
  'pre_departure',
  'departure_ready',
  'assigned',
  'arrived'
]);

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

function toIsoDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const parsed = Date.parse(`${text}T00:00:00Z`);
      if (Number.isFinite(parsed)) return text;
      return null;
    }
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return null;
}

function normalizeStage(value, fallback) {
  const normalized = normalizeString(value, fallback || 'unspecified');
  if (normalized === null || normalized === '') return 'unspecified';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_STAGES.includes(lowered)) return null;
  return lowered;
}

function normalizeSchedule(lineUserId, input) {
  const payload = input && typeof input === 'object' ? input : {};
  return {
    lineUserId: normalizeLineUserId(lineUserId),
    departureDate: toIsoDate(payload.departureDate),
    assignmentDate: toIsoDate(payload.assignmentDate),
    stage: normalizeStage(payload.stage, 'unspecified'),
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

async function getUserJourneySchedule(lineUserId) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeSchedule(id, snap.data());
}

async function upsertUserJourneySchedule(lineUserId, patch, actor) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) throw new Error('lineUserId required');
  const payload = patch && typeof patch === 'object' ? patch : {};
  const normalized = normalizeSchedule(id, payload);
  if (payload.departureDate !== undefined && payload.departureDate !== null && payload.departureDate !== '' && !normalized.departureDate) {
    throw new Error('invalid departureDate');
  }
  if (payload.assignmentDate !== undefined && payload.assignmentDate !== null && payload.assignmentDate !== '' && !normalized.assignmentDate) {
    throw new Error('invalid assignmentDate');
  }
  if (normalized.stage === null) {
    throw new Error('invalid stage');
  }
  const updatedBy = normalizeString(actor, normalized.updatedBy || 'unknown') || 'unknown';
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    updatedAt: payload.updatedAt || serverTimestamp(),
    updatedBy
  }), { merge: true });
  return getUserJourneySchedule(id);
}

async function listUserJourneySchedulesByLineUserIds(params) {
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
      return normalizeSchedule(lineUserId, snap.data());
    }));
    docs.filter(Boolean).forEach((row) => rows.push(row));
  }
  return rows;
}

module.exports = {
  COLLECTION,
  ALLOWED_STAGES,
  normalizeSchedule,
  getUserJourneySchedule,
  upsertUserJourneySchedule,
  listUserJourneySchedulesByLineUserIds
};
