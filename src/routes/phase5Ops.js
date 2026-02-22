'use strict';

const { getUsersSummaryFiltered } = require('../usecases/phase5/getUsersSummaryFiltered');
const { getNotificationsSummaryFiltered } = require('../usecases/phase5/getNotificationsSummaryFiltered');
const { getStaleMemberNumberUsers } = require('../usecases/phase5/getStaleMemberNumberUsers');
const { getOpsState } = require('../repos/firestore/opsStateRepo');

function formatTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function parseDateParam(value, endOfDay) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date.getTime();
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('invalid date') || message.includes('invalid reviewAgeDays') || message.includes('invalid limit')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

function parseRange(url) {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const fromMs = parseDateParam(from, false);
  const toMs = parseDateParam(to, true);
  if ((from && !fromMs) || (to && !toMs)) {
    throw new Error('invalid date');
  }
  return { fromMs, toMs };
}

function parseReviewAgeDays(value) {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < 1 || num > 365) return null;
  return num;
}

function parsePositiveInt(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

async function handleUsersSummaryFiltered(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const range = parseRange(url);
    const needsAttention = url.searchParams.get('needsAttention') === '1';
    const stale = url.searchParams.get('stale') === '1';
    const unreviewed = url.searchParams.get('unreviewed') === '1';
    const reviewAgeRaw = url.searchParams.get('reviewAgeDays');
    const reviewAgeDays = parseReviewAgeDays(reviewAgeRaw);
    const limitRaw = url.searchParams.get('limit');
    const analyticsLimitRaw = url.searchParams.get('analyticsLimit');
    const limit = parsePositiveInt(limitRaw, 1, 500);
    const analyticsLimit = parsePositiveInt(analyticsLimitRaw, 1, 3000);
    if (reviewAgeRaw && !reviewAgeDays) {
      throw new Error('invalid reviewAgeDays');
    }
    if ((limitRaw && !limit) || (analyticsLimitRaw && !analyticsLimit)) {
      throw new Error('invalid limit');
    }
    const [items, opsState] = await Promise.all([
      getUsersSummaryFiltered(Object.assign({}, range, {
        needsAttention,
        stale,
        unreviewed,
        reviewAgeDays,
        limit,
        analyticsLimit
      })),
      getOpsState()
    ]);
    const review = opsState
      ? {
          lastReviewedAt: formatTimestamp(opsState.lastReviewedAt),
          lastReviewedBy: opsState.lastReviewedBy || null
        }
      : null;
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, items, review }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleNotificationsSummaryFiltered(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const range = parseRange(url);
    const limitRaw = url.searchParams.get('limit');
    const eventsLimitRaw = url.searchParams.get('eventsLimit');
    const limit = parsePositiveInt(limitRaw, 1, 500);
    const eventsLimit = parsePositiveInt(eventsLimitRaw, 1, 3000);
    if ((limitRaw && !limit) || (eventsLimitRaw && !eventsLimit)) {
      throw new Error('invalid limit');
    }
    const items = await getNotificationsSummaryFiltered(Object.assign({}, range, {
      limit,
      eventsLimit
    }));
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, items }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleStaleMemberNumber(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const limitRaw = url.searchParams.get('limit');
    const limit = parsePositiveInt(limitRaw, 1, 500);
    if (limitRaw && !limit) {
      throw new Error('invalid limit');
    }
    const result = await getStaleMemberNumberUsers({ limit });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, count: result.count, items: result.items }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleUsersSummaryFiltered,
  handleNotificationsSummaryFiltered,
  handleStaleMemberNumber
};
