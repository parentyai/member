'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'city_pack_metrics_daily';

function normalizeDateKey(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('dateKey required');
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error('dateKey invalid');
  return trimmed;
}

function normalizeIdPart(value, fallback) {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return String(raw || fallback).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function normalizeCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function normalizeRatio(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(Math.min(num, 1) * 10000) / 10000;
}

function buildMetricId(payload) {
  const dateKey = normalizeDateKey(payload.dateKey);
  const cityPackId = normalizeIdPart(payload.cityPackId, 'unmapped');
  const slotId = normalizeIdPart(payload.slotId, 'default');
  const sourceRefId = normalizeIdPart(payload.sourceRefId, 'none');
  return `${dateKey}__${cityPackId}__${slotId}__${sourceRefId}`;
}

function normalizeMetricRow(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const dateKey = normalizeDateKey(payload.dateKey);
  const cityPackId = typeof payload.cityPackId === 'string' && payload.cityPackId.trim() ? payload.cityPackId.trim() : 'unmapped';
  const slotId = typeof payload.slotId === 'string' && payload.slotId.trim() ? payload.slotId.trim() : 'default';
  const sourceRefId = typeof payload.sourceRefId === 'string' && payload.sourceRefId.trim() ? payload.sourceRefId.trim() : 'none';
  const sentCount = normalizeCount(payload.sentCount);
  const deliveredCount = normalizeCount(payload.deliveredCount);
  const clickCount = normalizeCount(payload.clickCount);
  const readCount = normalizeCount(payload.readCount);
  const failedCount = normalizeCount(payload.failedCount);
  const ctr = normalizeRatio(payload.ctr);
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null;
  const lastComputedAt = payload.lastComputedAt || serverTimestamp();
  return {
    id: buildMetricId({ dateKey, cityPackId, slotId, sourceRefId }),
    dateKey,
    cityPackId,
    slotId,
    sourceRefId,
    sentCount,
    deliveredCount,
    clickCount,
    readCount,
    failedCount,
    ctr,
    traceId,
    lastComputedAt,
    updatedAt: serverTimestamp()
  };
}

async function upsertMetricRow(row) {
  const payload = normalizeMetricRow(row);
  const db = getDb();
  await db.collection(COLLECTION).doc(payload.id).set(payload, { merge: true });
  return { id: payload.id };
}

async function upsertMetricRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  for (const row of list) {
    const result = await upsertMetricRow(row);
    out.push(result.id);
  }
  return out;
}

async function listMetricRows(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(opts.limit)) ? Math.max(1, Math.min(Math.floor(Number(opts.limit)), 1000)) : 200;
  const dateFrom = opts.dateFrom ? normalizeDateKey(opts.dateFrom) : null;
  const dateTo = opts.dateTo ? normalizeDateKey(opts.dateTo) : null;
  const cityPackId = typeof opts.cityPackId === 'string' && opts.cityPackId.trim() ? opts.cityPackId.trim() : null;

  const db = getDb();
  let query = db.collection(COLLECTION);
  if (cityPackId) query = query.where('cityPackId', '==', cityPackId);
  if (dateFrom) query = query.where('dateKey', '>=', dateFrom);
  if (dateTo) query = query.where('dateKey', '<=', dateTo);
  const snap = await query.orderBy('dateKey', 'desc').limit(limit).get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  return rows;
}

module.exports = {
  buildMetricId,
  normalizeMetricRow,
  upsertMetricRow,
  upsertMetricRows,
  listMetricRows
};
