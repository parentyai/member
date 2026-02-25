'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'notification_deliveries';
const DEFAULT_BACKFILL_LIMIT = 200;
const MAX_BACKFILL_LIMIT = 1000;
const BACKFILL_SAMPLE_LIMIT = 20;
const REACTION_ACTIONS_V2 = Object.freeze(['open', 'save', 'snooze', 'none', 'redeem', 'response']);

function resolveTimestamp(at) {
  // Allow explicit null when callers want to indicate "not set yet".
  if (at === null) return null;
  return at || serverTimestamp();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function resolveDeliveredAt(record) {
  if (!record || typeof record !== 'object') return null;
  return toDate(record.deliveredAt) || toDate(record.sentAt) || null;
}

function stripUndefinedFields(data) {
  const input = data && typeof data === 'object' ? data : {};
  const cleaned = {};
  for (const key of Object.keys(input)) {
    if (input[key] !== undefined) cleaned[key] = input[key];
  }
  return cleaned;
}

function toIso(value) {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
}

function normalizeBackfillLimit(limit) {
  if (limit === undefined || limit === null || limit === '') return DEFAULT_BACKFILL_LIMIT;
  const num = typeof limit === 'number' ? limit : Number(limit);
  if (!Number.isInteger(num) || num < 1 || num > MAX_BACKFILL_LIMIT) {
    throw new Error(`limit must be integer 1-${MAX_BACKFILL_LIMIT}`);
  }
  return num;
}

function isIndexError(err) {
  if (!err) return false;
  if (err.code === 9 || err.code === '9') return true; // Firestore FAILED_PRECONDITION
  if (typeof err.message !== 'string') return false;
  const lower = err.message.toLowerCase();
  return lower.includes('failed precondition') || lower.includes('index');
}

function buildDeliveredBaseQuery(db, lineUserId, notificationCategory) {
  let query = db.collection(COLLECTION)
    .where('lineUserId', '==', lineUserId)
    .where('delivered', '==', true);
  if (notificationCategory) {
    query = query.where('notificationCategory', '==', notificationCategory);
  }
  return query;
}

function normalizeCountOptions(options) {
  const payload = options && typeof options === 'object' ? options : {};
  return {
    includeLegacyFallback: payload.includeLegacyFallback !== false
  };
}

function normalizeCategoryValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

function normalizeCategoryList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = normalizeCategoryValue(value);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function normalizeReactionActionV2(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  return REACTION_ACTIONS_V2.includes(normalized) ? normalized : '';
}

function normalizeOptionalIso(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
}

async function queryCount(query) {
  if (query && typeof query.count === 'function') {
    try {
      const aggregate = await query.count().get();
      if (aggregate && typeof aggregate.data === 'function') {
        const value = aggregate.data();
        if (value && Number.isFinite(value.count)) return value.count;
      }
    } catch (_err) {
      // Fall back to docs.length when aggregate query is unavailable.
    }
  }
  const snap = await query.get();
  return Array.isArray(snap.docs) ? snap.docs.length : 0;
}

async function countDeliveredSinceFallback({ db, lineUserId, sinceDate, notificationCategory }) {
  const snap = await buildDeliveredBaseQuery(db, lineUserId, notificationCategory).get();
  let count = 0;
  for (const doc of snap.docs) {
    const record = doc.data() || {};
    const at = resolveDeliveredAt(record);
    if (at && at.getTime() >= sinceDate.getTime()) count += 1;
  }
  return count;
}

async function countDeliveredAtSinceFallback({ db, lineUserId, sinceDate, notificationCategory }) {
  const snap = await buildDeliveredBaseQuery(db, lineUserId, notificationCategory).get();
  let count = 0;
  for (const doc of snap.docs) {
    const record = doc.data() || {};
    const deliveredAt = toDate(record.deliveredAt);
    if (!deliveredAt) continue;
    if (deliveredAt.getTime() >= sinceDate.getTime()) count += 1;
  }
  return count;
}

async function countDeliveredSinceOptimized({ db, lineUserId, sinceDate, notificationCategory, includeLegacyFallback }) {
  const sinceIso = toIso(sinceDate);
  if (!sinceIso) throw new Error('sinceAt required');

  const base = buildDeliveredBaseQuery(db, lineUserId, notificationCategory);
  const deliveredAtQuery = base.where('deliveredAt', '>=', sinceIso);
  const deliveredAtCount = await queryCount(deliveredAtQuery);
  if (!includeLegacyFallback) return deliveredAtCount;

  // Legacy compatibility: old rows may not have deliveredAt but still have sentAt.
  const legacySnap = await base.where('sentAt', '>=', sinceIso).get();
  let legacyCount = 0;
  for (const doc of legacySnap.docs) {
    const record = doc.data() || {};
    if (toDate(record.deliveredAt)) continue;
    const at = resolveDeliveredAt(record);
    if (!at || at.getTime() < sinceDate.getTime()) continue;
    if (notificationCategory) {
      const recCategory = typeof record.notificationCategory === 'string'
        ? record.notificationCategory.trim().toUpperCase()
        : '';
      if (recCategory !== notificationCategory) continue;
    }
    legacyCount += 1;
  }
  return deliveredAtCount + legacyCount;
}

async function createDelivery(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const base = stripUndefinedFields(data);
  const payload = Object.assign({}, base, { sentAt: resolveTimestamp(data && data.sentAt) });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

function reserveDeliveryId() {
  const db = getDb();
  return db.collection(COLLECTION).doc().id;
}

async function createDeliveryWithId(deliveryId, data) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  const base = stripUndefinedFields(data);
  const payload = Object.assign({}, base, { sentAt: resolveTimestamp(data && data.sentAt) });
  await docRef.set(payload, { merge: true });
  return { id: docRef.id };
}

async function sealDeliveryWithId(deliveryId, data) {
  if (!deliveryId) throw new Error('deliveryId required');
  const payload = data && typeof data === 'object' ? data : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  const snap = await docRef.get();
  if (!snap.exists) return { ok: false, reason: 'not_found', id: deliveryId };
  const record = snap.data() || {};
  if (record.delivered === true) return { ok: false, reason: 'already_delivered', id: deliveryId };
  if (record.sealed === true) return { ok: true, id: deliveryId, alreadySealed: true };
  await docRef.set({
    sealed: true,
    sealedAt: resolveTimestamp(payload.sealedAt),
    sealedBy: payload.sealedBy || null,
    sealedReason: payload.sealedReason || null,
    state: 'sealed'
  }, { merge: true });
  return { ok: true, id: deliveryId, sealed: true };
}

async function reserveDeliveryWithId(deliveryId, data) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  const reservedAt = resolveTimestamp(data && data.reservedAt);
  // Reserve (create) the delivery doc before sending to prevent duplicates
  // across process crashes. If it already exists, return the existing doc.
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.exists) {
      return { id: deliveryId, existing: Object.assign({ id: deliveryId }, snap.data()) };
    }
    tx.set(docRef, Object.assign({}, data || {}, {
      delivered: false,
      state: 'reserved',
      reservedAt,
      sentAt: null
    }), { merge: false });
    return { id: deliveryId, reserved: true };
  });
}

async function getDelivery(deliveryId) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function markRead(deliveryId, at) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  await docRef.set({ readAt: resolveTimestamp(at) }, { merge: true });
  return { id: deliveryId };
}

async function markClick(deliveryId, at) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  await docRef.set({ clickAt: resolveTimestamp(at) }, { merge: true });
  return { id: deliveryId };
}

async function markReactionV2(deliveryId, action, options) {
  if (!deliveryId) throw new Error('deliveryId required');
  const normalizedAction = normalizeReactionActionV2(action);
  if (!normalizedAction) throw new Error('invalid action');
  const payload = options && typeof options === 'object' ? options : {};
  const at = resolveTimestamp(payload.at);
  const patch = {
    lastSignal: normalizedAction,
    lastSignalAt: at
  };
  if (normalizedAction === 'open') {
    patch.openAt = at;
    patch.readAt = at;
  } else if (normalizedAction === 'save') {
    patch.savedAt = at;
  } else if (normalizedAction === 'snooze') {
    patch.snoozedAt = at;
    const snoozeUntil = normalizeOptionalIso(payload.snoozeUntil);
    if (snoozeUntil) patch.snoozeUntil = snoozeUntil;
  } else if (normalizedAction === 'none') {
    patch.noReactionAt = at;
  } else if (normalizedAction === 'redeem') {
    patch.redeemedAt = at;
  } else if (normalizedAction === 'response') {
    patch.respondedAt = at;
    if (typeof payload.responseText === 'string' && payload.responseText.trim()) {
      patch.responseText = payload.responseText.trim().slice(0, 2000);
    }
  }
  if (typeof payload.traceId === 'string' && payload.traceId.trim()) {
    patch.lastSignalTraceId = payload.traceId.trim();
  }
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  await docRef.set(patch, { merge: true });
  return getDelivery(deliveryId);
}

async function listDeliveriesByUser(lineUserId, limit) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  let query = db.collection(COLLECTION).where('lineUserId', '==', lineUserId).orderBy('sentAt', 'desc');
  const max = typeof limit === 'number' ? limit : 50;
  if (max) query = query.limit(max);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function listDeliveriesByNotificationId(notificationId) {
  if (!notificationId) throw new Error('notificationId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('notificationId', '==', notificationId).get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function countDeliveredByUserSince(lineUserId, sinceAt, options) {
  if (!lineUserId) throw new Error('lineUserId required');
  const sinceDate = toDate(sinceAt);
  if (!sinceDate) throw new Error('sinceAt required');
  const countOptions = normalizeCountOptions(options);
  const db = getDb();
  try {
    return await countDeliveredSinceOptimized({
      db,
      lineUserId,
      sinceDate,
      notificationCategory: null,
      includeLegacyFallback: countOptions.includeLegacyFallback
    });
  } catch (err) {
    if (!isIndexError(err)) throw err;
    if (!countOptions.includeLegacyFallback) {
      return countDeliveredAtSinceFallback({
        db,
        lineUserId,
        sinceDate,
        notificationCategory: null
      });
    }
    return countDeliveredSinceFallback({
      db,
      lineUserId,
      sinceDate,
      notificationCategory: null
    });
  }
}

async function countDeliveredByUserCategorySince(lineUserId, notificationCategory, sinceAt, options) {
  if (!lineUserId) throw new Error('lineUserId required');
  const category = typeof notificationCategory === 'string' ? notificationCategory.trim().toUpperCase() : '';
  if (!category) throw new Error('notificationCategory required');
  const sinceDate = toDate(sinceAt);
  if (!sinceDate) throw new Error('sinceAt required');
  const countOptions = normalizeCountOptions(options);
  const db = getDb();
  try {
    return await countDeliveredSinceOptimized({
      db,
      lineUserId,
      sinceDate,
      notificationCategory: category,
      includeLegacyFallback: countOptions.includeLegacyFallback
    });
  } catch (err) {
    if (!isIndexError(err)) throw err;
    if (!countOptions.includeLegacyFallback) {
      return countDeliveredAtSinceFallback({
        db,
        lineUserId,
        sinceDate,
        notificationCategory: category
      });
    }
    return countDeliveredSinceFallback({
      db,
      lineUserId,
      sinceDate,
      notificationCategory: category
    });
  }
}

async function getDeliveredCountsSnapshotOptimized(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const db = payload.db;
  const lineUserId = payload.lineUserId;
  const weeklySinceDate = payload.weeklySinceDate;
  const dailySinceDate = payload.dailySinceDate || null;
  const categories = normalizeCategoryList(payload.categories);
  const includeLegacyFallback = payload.includeLegacyFallback !== false;
  const weeklySinceIso = toIso(weeklySinceDate);
  const dailySinceIso = toIso(dailySinceDate);
  if (!weeklySinceIso) throw new Error('weeklySinceAt required');

  const base = buildDeliveredBaseQuery(db, lineUserId, null);
  const promises = [
    queryCount(base.where('deliveredAt', '>=', weeklySinceIso)),
    dailySinceIso ? queryCount(base.where('deliveredAt', '>=', dailySinceIso)) : Promise.resolve(0),
    Promise.all(categories.map((category) => (
      queryCount(
        base
          .where('notificationCategory', '==', category)
          .where('deliveredAt', '>=', weeklySinceIso)
      ).then((count) => ({ category, count }))
    )))
  ];
  const [weeklyDeliveredAtCount, dailyDeliveredAtCount, byCategoryDeliveredAt] = await Promise.all(promises);

  const categoryWeeklyCounts = {};
  for (const entry of byCategoryDeliveredAt) {
    categoryWeeklyCounts[entry.category] = Number.isFinite(entry.count) ? entry.count : 0;
  }
  let weeklyCount = Number.isFinite(weeklyDeliveredAtCount) ? weeklyDeliveredAtCount : 0;
  let dailyCount = Number.isFinite(dailyDeliveredAtCount) ? dailyDeliveredAtCount : 0;

  if (includeLegacyFallback) {
    const categorySet = new Set(categories);
    const legacySnap = await base.where('sentAt', '>=', weeklySinceIso).get();
    for (const doc of legacySnap.docs) {
      const record = doc.data() || {};
      // deliveredAt を持つ行は aggregate 側で計上済み。
      if (toDate(record.deliveredAt)) continue;
      const at = resolveDeliveredAt(record);
      if (!at) continue;
      if (at.getTime() < weeklySinceDate.getTime()) continue;
      weeklyCount += 1;
      if (dailySinceDate && at.getTime() >= dailySinceDate.getTime()) {
        dailyCount += 1;
      }
      if (categorySet.size > 0) {
        const category = normalizeCategoryValue(record.notificationCategory);
        if (category && categorySet.has(category)) {
          categoryWeeklyCounts[category] = (categoryWeeklyCounts[category] || 0) + 1;
        }
      }
    }
  }

  return {
    weeklyCount,
    dailyCount: dailySinceDate ? dailyCount : 0,
    categoryWeeklyCounts,
    weeklySinceIso,
    dailySinceIso: dailySinceIso || null,
    includeLegacyFallback,
    countStrategy: 'snapshot_optimized'
  };
}

async function getDeliveredCountsSnapshotFallback(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const db = payload.db;
  const lineUserId = payload.lineUserId;
  const weeklySinceDate = payload.weeklySinceDate;
  const dailySinceDate = payload.dailySinceDate || null;
  const categories = normalizeCategoryList(payload.categories);
  const includeLegacyFallback = payload.includeLegacyFallback !== false;
  const weeklySinceIso = toIso(weeklySinceDate);
  const dailySinceIso = toIso(dailySinceDate);

  const snap = await buildDeliveredBaseQuery(db, lineUserId, null).get();
  const categorySet = new Set(categories);
  const categoryWeeklyCounts = {};
  for (const category of categories) categoryWeeklyCounts[category] = 0;

  let weeklyCount = 0;
  let dailyCount = 0;

  for (const doc of snap.docs) {
    const record = doc.data() || {};
    const deliveredAt = toDate(record.deliveredAt);
    const at = includeLegacyFallback ? resolveDeliveredAt(record) : deliveredAt;
    if (!at) continue;
    if (at.getTime() < weeklySinceDate.getTime()) continue;
    weeklyCount += 1;
    if (dailySinceDate && at.getTime() >= dailySinceDate.getTime()) {
      dailyCount += 1;
    }
    if (categorySet.size > 0) {
      const category = normalizeCategoryValue(record.notificationCategory);
      if (category && categorySet.has(category)) {
        categoryWeeklyCounts[category] = (categoryWeeklyCounts[category] || 0) + 1;
      }
    }
  }

  return {
    weeklyCount,
    dailyCount: dailySinceDate ? dailyCount : 0,
    categoryWeeklyCounts,
    weeklySinceIso,
    dailySinceIso: dailySinceIso || null,
    includeLegacyFallback,
    countStrategy: 'snapshot_fallback'
  };
}

async function getDeliveredCountsSnapshot(lineUserId, params) {
  if (!lineUserId) throw new Error('lineUserId required');
  const payload = params && typeof params === 'object' ? params : {};
  const weeklySinceDate = toDate(payload.weeklySinceAt);
  if (!weeklySinceDate) throw new Error('weeklySinceAt required');
  const dailySinceDate = payload.dailySinceAt ? toDate(payload.dailySinceAt) : null;
  if (payload.dailySinceAt && !dailySinceDate) throw new Error('dailySinceAt invalid');
  const categories = normalizeCategoryList(payload.categories);
  const countOptions = normalizeCountOptions(payload);
  const db = getDb();

  try {
    return await getDeliveredCountsSnapshotOptimized({
      db,
      lineUserId,
      weeklySinceDate,
      dailySinceDate,
      categories,
      includeLegacyFallback: countOptions.includeLegacyFallback
    });
  } catch (err) {
    if (!isIndexError(err)) throw err;
    return getDeliveredCountsSnapshotFallback({
      db,
      lineUserId,
      weeklySinceDate,
      dailySinceDate,
      categories,
      includeLegacyFallback: countOptions.includeLegacyFallback
    });
  }
}

async function getDeliveredAtBackfillSummary(limit) {
  const max = normalizeBackfillLimit(limit);
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('delivered', '==', true).get();
  const docs = Array.isArray(snap.docs) ? snap.docs.slice().sort((a, b) => String(a.id).localeCompare(String(b.id))) : [];

  let deliveredCount = 0;
  let missingDeliveredAtCount = 0;
  let fixableCount = 0;
  let unfixableCount = 0;
  const candidates = [];
  const sampleFixable = [];
  const sampleUnfixable = [];

  for (const doc of docs) {
    const record = doc.data() || {};
    deliveredCount += 1;
    if (toDate(record.deliveredAt)) continue;
    missingDeliveredAtCount += 1;
    const sentAtIso = toIso(record.sentAt);
    if (sentAtIso) {
      fixableCount += 1;
      const candidate = { deliveryId: doc.id, sentAtIso };
      if (candidates.length < max) candidates.push(candidate);
      if (sampleFixable.length < BACKFILL_SAMPLE_LIMIT) sampleFixable.push(candidate);
      continue;
    }
    unfixableCount += 1;
    if (sampleUnfixable.length < BACKFILL_SAMPLE_LIMIT) {
      sampleUnfixable.push({
        deliveryId: doc.id,
        state: typeof record.state === 'string' ? record.state : null
      });
    }
  }

  return {
    limit: max,
    deliveredCount,
    missingDeliveredAtCount,
    fixableCount,
    unfixableCount,
    candidates,
    sampleFixable,
    sampleUnfixable
  };
}

async function applyDeliveredAtBackfill(candidates, options) {
  const list = Array.isArray(candidates) ? candidates : [];
  const actor = options && typeof options.actor === 'string' && options.actor.trim().length > 0
    ? options.actor.trim()
    : null;
  const atIso = toIso(options && options.backfilledAt) || new Date().toISOString();
  const db = getDb();
  const updatedIds = [];
  const skippedIds = [];

  for (const entry of list) {
    const deliveryId = entry && typeof entry.deliveryId === 'string' ? entry.deliveryId.trim() : '';
    const sentAtIso = toIso(entry && entry.sentAtIso);
    if (!deliveryId || !sentAtIso) {
      if (deliveryId) skippedIds.push(deliveryId);
      continue;
    }
    await db.collection(COLLECTION).doc(deliveryId).set({
      deliveredAt: sentAtIso,
      deliveredAtBackfilledAt: atIso,
      deliveredAtBackfilledBy: actor
    }, { merge: true });
    updatedIds.push(deliveryId);
  }

  return {
    ok: true,
    updatedCount: updatedIds.length,
    updatedIds,
    skippedCount: skippedIds.length,
    skippedIds,
    backfilledAt: atIso
  };
}

module.exports = {
  createDelivery,
  reserveDeliveryId,
  createDeliveryWithId,
  sealDeliveryWithId,
  reserveDeliveryWithId,
  getDelivery,
  markRead,
  markClick,
  markReactionV2,
  listDeliveriesByUser,
  listDeliveriesByNotificationId,
  countDeliveredByUserSince,
  countDeliveredByUserCategorySince,
  getDeliveredCountsSnapshot,
  getDeliveredAtBackfillSummary,
  applyDeliveredAtBackfill
};
