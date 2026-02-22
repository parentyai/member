'use strict';

const { getDb } = require('../../infra/firestore');

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;
const IN_QUERY_CHUNK_SIZE = 10;

function resolveLimit(value) {
  if (value === undefined || value === null) return DEFAULT_LIMIT;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(num), MAX_LIMIT);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toMillis(value) {
  const date = toDate(value);
  return date ? date.getTime() : null;
}

function sortRowsByFieldDesc(rows, fieldName) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  list.sort((a, b) => {
    const aMs = toMillis(a && a.data && a.data[fieldName]);
    const bMs = toMillis(b && b.data && b.data[fieldName]);
    if (aMs && bMs) return bMs - aMs;
    if (aMs) return -1;
    if (bMs) return 1;
    const aId = String(a && a.id ? a.id : '');
    const bId = String(b && b.id ? b.id : '');
    return aId.localeCompare(bId);
  });
  return list;
}

function dedupeById(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row || !row.id) continue;
    if (!map.has(row.id)) map.set(row.id, row);
  }
  return Array.from(map.values());
}

function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean)
  ));
}

function chunkList(list, size) {
  const chunkSize = Math.max(1, Number(size) || IN_QUERY_CHUNK_SIZE);
  const chunks = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    chunks.push(list.slice(i, i + chunkSize));
  }
  return chunks;
}

async function listAllEvents(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('events').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listEventsByCreatedAtRange(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const fromAt = toDate(options.fromAt);
  const toAt = toDate(options.toAt);
  const db = getDb();
  let query = db.collection('events');
  if (fromAt) query = query.where('createdAt', '>=', fromAt);
  if (toAt) query = query.where('createdAt', '<=', toAt);
  const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listEventsByLineUserIdAndCreatedAtRange(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const lineUserId = typeof options.lineUserId === 'string' ? options.lineUserId.trim() : '';
  if (!lineUserId) return [];
  const limit = resolveLimit(options.limit);
  const fromAt = toDate(options.fromAt);
  const toAt = toDate(options.toAt);
  const db = getDb();
  let query = db.collection('events').where('lineUserId', '==', lineUserId);
  if (fromAt) query = query.where('createdAt', '>=', fromAt);
  if (toAt) query = query.where('createdAt', '<=', toAt);
  const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listEventsByLineUserIdsAndCreatedAtRange(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const lineUserIds = normalizeIdList(options.lineUserIds);
  if (!lineUserIds.length) return [];
  const limit = resolveLimit(options.limit);
  const fromAt = toDate(options.fromAt);
  const toAt = toDate(options.toAt);
  const db = getDb();
  const chunks = chunkList(lineUserIds, IN_QUERY_CHUNK_SIZE);
  const perChunkLimit = Math.max(1, Math.floor(limit / Math.max(1, chunks.length)));
  const settled = await Promise.all(chunks.map(async (chunk) => {
    const rowsByUser = await Promise.all(chunk.map(async (lineUserId) => {
      let query = db.collection('events').where('lineUserId', '==', lineUserId);
      if (fromAt) query = query.where('createdAt', '>=', fromAt);
      if (toAt) query = query.where('createdAt', '<=', toAt);
      const snap = await query.orderBy('createdAt', 'desc').limit(perChunkLimit).get();
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    }));
    return rowsByUser.flat();
  }));
  const merged = dedupeById(settled.flat());
  return sortRowsByFieldDesc(merged, 'createdAt').slice(0, limit);
}

async function listAllUsers(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listUsersByCreatedAtRange(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const fromAt = toDate(options.fromAt);
  const toAt = toDate(options.toAt);
  const db = getDb();
  let query = db.collection('users');
  if (fromAt) query = query.where('createdAt', '>=', fromAt);
  if (toAt) query = query.where('createdAt', '<=', toAt);
  const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listUsersByLineUserIds(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const lineUserIds = normalizeIdList(options.lineUserIds);
  if (!lineUserIds.length) return [];
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const chunks = chunkList(lineUserIds, IN_QUERY_CHUNK_SIZE);
  const perChunkLimit = Math.max(1, Math.floor(limit / Math.max(1, chunks.length)));
  const settled = await Promise.all(chunks.map(async (chunk) => {
    const rows = await Promise.all(chunk.map(async (lineUserId) => {
      const snap = await db.collection('users').doc(lineUserId).get();
      if (!snap.exists) return null;
      return { id: snap.id, data: snap.data() };
    }));
    return rows.filter(Boolean).slice(0, perChunkLimit);
  }));
  const merged = dedupeById(settled.flat());
  return sortRowsByFieldDesc(merged, 'createdAt').slice(0, limit);
}

async function listAllChecklists(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('checklists').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listChecklistsByScenarioAndStep(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const scenario = typeof options.scenario === 'string' ? options.scenario.trim() : '';
  const step = typeof options.step === 'string' ? options.step.trim() : '';
  if (!scenario || !step) return [];
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db
    .collection('checklists')
    .where('scenario', '==', scenario)
    .where('step', '==', step)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

function normalizeScenarioStepPairs(value) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  const seen = new Set();
  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const scenarioRaw = typeof entry.scenarioKey === 'string' ? entry.scenarioKey : entry.scenario;
    const stepRaw = typeof entry.stepKey === 'string' ? entry.stepKey : entry.step;
    const scenario = typeof scenarioRaw === 'string' ? scenarioRaw.trim() : '';
    const step = typeof stepRaw === 'string' ? stepRaw.trim() : '';
    if (!scenario || !step) return;
    const key = `${scenario}__${step}`;
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({ scenario, step });
  });
  return normalized;
}

async function listChecklistsByScenarioStepPairs(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const pairs = normalizeScenarioStepPairs(options.pairs);
  if (!pairs.length) return [];
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const perPairLimit = Math.max(1, Math.floor(limit / Math.max(1, pairs.length)));
  const settled = await Promise.all(pairs.map(async (pair) => {
    const snap = await db
      .collection('checklists')
      .where('scenario', '==', pair.scenario)
      .where('step', '==', pair.step)
      .orderBy('createdAt', 'desc')
      .limit(perPairLimit)
      .get();
    return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  }));
  const merged = dedupeById(settled.flat());
  return sortRowsByFieldDesc(merged, 'createdAt').slice(0, limit);
}

async function listAllUserChecklists(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('user_checklists').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listUserChecklistsByLineUserId(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const lineUserId = typeof options.lineUserId === 'string' ? options.lineUserId.trim() : '';
  if (!lineUserId) return [];
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db
    .collection('user_checklists')
    .where('lineUserId', '==', lineUserId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listUserChecklistsByLineUserIds(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const lineUserIds = normalizeIdList(options.lineUserIds);
  if (!lineUserIds.length) return [];
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const chunks = chunkList(lineUserIds, IN_QUERY_CHUNK_SIZE);
  const perChunkLimit = Math.max(1, Math.floor(limit / Math.max(1, chunks.length)));
  const settled = await Promise.all(chunks.map(async (chunk) => {
    const rowsByUser = await Promise.all(chunk.map(async (lineUserId) => {
      const snap = await db
        .collection('user_checklists')
        .where('lineUserId', '==', lineUserId)
        .orderBy('createdAt', 'desc')
        .limit(perChunkLimit)
        .get();
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    }));
    return rowsByUser.flat();
  }));
  const merged = dedupeById(settled.flat());
  return sortRowsByFieldDesc(merged, 'createdAt').slice(0, limit);
}

async function listAllNotificationDeliveries(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('notification_deliveries').orderBy('sentAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listNotificationDeliveriesBySentAtRange(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const fromAt = toDate(options.fromAt);
  const toAt = toDate(options.toAt);
  const db = getDb();
  let query = db.collection('notification_deliveries');
  if (fromAt) query = query.where('sentAt', '>=', fromAt);
  if (toAt) query = query.where('sentAt', '<=', toAt);
  const snap = await query.orderBy('sentAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listNotificationDeliveriesByLineUserIdAndSentAtRange(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const lineUserId = typeof options.lineUserId === 'string' ? options.lineUserId.trim() : '';
  if (!lineUserId) return [];
  const limit = resolveLimit(options.limit);
  const fromAt = toDate(options.fromAt);
  const toAt = toDate(options.toAt);
  const db = getDb();
  let query = db.collection('notification_deliveries').where('lineUserId', '==', lineUserId);
  if (fromAt) query = query.where('sentAt', '>=', fromAt);
  if (toAt) query = query.where('sentAt', '<=', toAt);
  const snap = await query.orderBy('sentAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listNotificationDeliveriesByLineUserIdsAndSentAtRange(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const lineUserIds = normalizeIdList(options.lineUserIds);
  if (!lineUserIds.length) return [];
  const limit = resolveLimit(options.limit);
  const fromAt = toDate(options.fromAt);
  const toAt = toDate(options.toAt);
  const db = getDb();
  const chunks = chunkList(lineUserIds, IN_QUERY_CHUNK_SIZE);
  const perChunkLimit = Math.max(1, Math.floor(limit / Math.max(1, chunks.length)));
  const settled = await Promise.all(chunks.map(async (chunk) => {
    const rowsByUser = await Promise.all(chunk.map(async (lineUserId) => {
      let query = db.collection('notification_deliveries').where('lineUserId', '==', lineUserId);
      if (fromAt) query = query.where('sentAt', '>=', fromAt);
      if (toAt) query = query.where('sentAt', '<=', toAt);
      const snap = await query.orderBy('sentAt', 'desc').limit(perChunkLimit).get();
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    }));
    return rowsByUser.flat();
  }));
  const merged = dedupeById(settled.flat());
  return sortRowsByFieldDesc(merged, 'sentAt').slice(0, limit);
}

async function listEventsByNotificationIdsAndCreatedAtRange(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const notificationIds = normalizeIdList(options.notificationIds);
  if (!notificationIds.length) return [];
  const limit = resolveLimit(options.limit);
  const fromAt = toDate(options.fromAt);
  const toAt = toDate(options.toAt);
  const db = getDb();
  const chunks = chunkList(notificationIds, IN_QUERY_CHUNK_SIZE);
  const perChunkLimit = Math.max(1, Math.floor(limit / Math.max(1, chunks.length)));
  const settled = await Promise.all(chunks.map(async (chunk) => {
    const rowsByNotification = await Promise.all(chunk.map(async (notificationId) => {
      let query = db.collection('events').where('ref.notificationId', '==', notificationId);
      if (fromAt) query = query.where('createdAt', '>=', fromAt);
      if (toAt) query = query.where('createdAt', '<=', toAt);
      const snap = await query.orderBy('createdAt', 'desc').limit(perChunkLimit).get();
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    }));
    return rowsByNotification.flat();
  }));
  const merged = dedupeById(settled.flat());
  return sortRowsByFieldDesc(merged, 'createdAt').slice(0, limit);
}

async function listAllNotifications(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('notifications').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listNotificationsByCreatedAtRange(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const fromAt = toDate(options.fromAt);
  const toAt = toDate(options.toAt);
  const db = getDb();
  let query = db.collection('notifications');
  if (fromAt) query = query.where('createdAt', '>=', fromAt);
  if (toAt) query = query.where('createdAt', '<=', toAt);
  const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

module.exports = {
  listAllEvents,
  listEventsByCreatedAtRange,
  listEventsByLineUserIdAndCreatedAtRange,
  listEventsByLineUserIdsAndCreatedAtRange,
  listAllUsers,
  listUsersByCreatedAtRange,
  listUsersByLineUserIds,
  listAllChecklists,
  listChecklistsByScenarioAndStep,
  listChecklistsByScenarioStepPairs,
  listAllUserChecklists,
  listUserChecklistsByLineUserId,
  listUserChecklistsByLineUserIds,
  listAllNotificationDeliveries,
  listNotificationDeliveriesBySentAtRange,
  listNotificationDeliveriesByLineUserIdAndSentAtRange,
  listNotificationDeliveriesByLineUserIdsAndSentAtRange,
  listEventsByNotificationIdsAndCreatedAtRange,
  listAllNotifications,
  listNotificationsByCreatedAtRange
};
