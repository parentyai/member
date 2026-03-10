'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../../infra/firestore');
const { InMemoryWebhookDedupeStore } = require('./dedupeStore');

const COLLECTION = 'webhook_edge_state';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().getTime();
    } catch (_err) {
      return 0;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function normalizeSourceKey(event) {
  const source = event && event.source && typeof event.source === 'object' ? event.source : {};
  return `${source.type || 'unknown'}:${source.userId || source.groupId || source.roomId || 'unknown'}`;
}

function hashKey(prefix, value) {
  const digest = crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 40);
  return `${prefix}_${digest}`;
}

class FirestoreWebhookEdgeStateStore {
  constructor(options) {
    const payload = options && typeof options === 'object' ? options : {};
    this.dedupeTtlMs = Number.isFinite(Number(payload.dedupeTtlMs))
      ? Math.max(60_000, Math.floor(Number(payload.dedupeTtlMs)))
      : 24 * 60 * 60 * 1000;
    this.orderingTtlMs = Number.isFinite(Number(payload.orderingTtlMs))
      ? Math.max(60_000, Math.floor(Number(payload.orderingTtlMs)))
      : 24 * 60 * 60 * 1000;
    this.inMemoryDedupe = payload.inMemoryDedupe || new InMemoryWebhookDedupeStore(this.dedupeTtlMs);
    this.inMemoryOrdering = new Map();
  }

  collection() {
    const db = getDb();
    return db.collection(COLLECTION);
  }

  dedupeDocId(key) {
    return hashKey('dedupe', key);
  }

  orderingDocId(sourceKey) {
    return hashKey('ordering', sourceKey);
  }

  async isSeen(key, nowMs) {
    if (!key) return false;
    const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    if (this.inMemoryDedupe.isSeen(key, now)) return true;
    try {
      const snap = await this.collection().doc(this.dedupeDocId(key)).get();
      if (!snap.exists) return false;
      const data = snap.data() || {};
      const expireAtMs = toMillis(data.expireAt);
      if (expireAtMs && expireAtMs <= now) return false;
      this.inMemoryDedupe.markSeen(key, now);
      return true;
    } catch (_err) {
      return this.inMemoryDedupe.isSeen(key, now);
    }
  }

  async markSeen(key, nowMs) {
    if (!key) return;
    const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    this.inMemoryDedupe.markSeen(key, now);
    try {
      await this.collection().doc(this.dedupeDocId(key)).set({
        kind: 'dedupe',
        dedupeKey: key,
        seenAt: new Date(now).toISOString(),
        expireAt: new Date(now + this.dedupeTtlMs).toISOString(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (_err) {
      // keep fail-open behavior; in-memory fallback already marked.
    }
  }

  async shouldDropByOrdering(event, options) {
    const payload = options && typeof options === 'object' ? options : {};
    const skewToleranceMs = Number.isFinite(Number(payload.skewToleranceMs))
      ? Math.max(0, Math.floor(Number(payload.skewToleranceMs)))
      : 20_000;
    const timestamp = Number.isFinite(Number(event && event.timestamp)) ? Number(event.timestamp) : 0;
    if (!timestamp) return false;
    const sourceKey = normalizeSourceKey(event);
    const inMemoryLatest = this.inMemoryOrdering.get(sourceKey) || 0;
    if (timestamp + skewToleranceMs < inMemoryLatest) return true;
    if (timestamp > inMemoryLatest) this.inMemoryOrdering.set(sourceKey, timestamp);

    try {
      const docRef = this.collection().doc(this.orderingDocId(sourceKey));
      const snap = await docRef.get();
      const data = snap.exists ? (snap.data() || {}) : {};
      const persistedLatest = Number.isFinite(Number(data.latestTimestamp))
        ? Number(data.latestTimestamp)
        : 0;
      const latest = Math.max(inMemoryLatest, persistedLatest);
      if (timestamp + skewToleranceMs < latest) return true;
      if (timestamp > latest) {
        await docRef.set({
          kind: 'ordering',
          sourceKey,
          latestTimestamp: timestamp,
          expireAt: new Date(Date.now() + this.orderingTtlMs).toISOString(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (_err) {
      // keep fail-open behavior; in-memory fallback already applied.
    }
    return false;
  }
}

module.exports = {
  FirestoreWebhookEdgeStateStore,
  normalizeSourceKey
};

