'use strict';

const llmUsageLogsRepo = require('../../repos/firestore/llmUsageLogsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

function parsePositiveInt(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return null;
}

function toDateKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function sumBy(array, selector) {
  return (Array.isArray(array) ? array : []).reduce((sum, row) => {
    const value = Number(selector(row));
    if (!Number.isFinite(value)) return sum;
    return sum + value;
  }, 0);
}

function normalizeReason(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || 'none';
}

function buildDailySeries(rows, windowDays) {
  const list = [];
  const now = new Date();
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    list.push({ dateKey: date.toISOString().slice(0, 10), calls: 0, tokens: 0, blocked: 0 });
  }
  const byKey = new Map(list.map((row) => [row.dateKey, row]));
  (rows || []).forEach((row) => {
    const ms = toMillis(row && row.createdAt);
    if (!Number.isFinite(ms)) return;
    const key = toDateKey(ms);
    const target = byKey.get(key);
    if (!target) return;
    target.calls += 1;
    const tokenUsed = Number.isFinite(Number(row && row.tokenUsed)) ? Number(row.tokenUsed) : 0;
    target.tokens += tokenUsed;
    const decision = String(row && row.decision ? row.decision : '').toLowerCase();
    if (decision !== 'allow') target.blocked += 1;
  });
  return list;
}

function buildReasonBreakdown(rows) {
  const counts = new Map();
  (rows || []).forEach((row) => {
    const decision = String(row && row.decision ? row.decision : '').toLowerCase();
    if (decision === 'allow') return;
    const reason = normalizeReason(row && row.blockedReason);
    counts.set(reason, (counts.get(reason) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function buildTopUsers(rows, limit) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const userId = typeof row.userId === 'string' && row.userId.trim() ? row.userId.trim() : 'unknown';
    const current = map.get(userId) || {
      userId,
      calls: 0,
      tokens: 0,
      blocked: 0,
      plan: typeof row.plan === 'string' && row.plan.trim() ? row.plan.trim() : 'free'
    };
    current.calls += 1;
    current.tokens += Number.isFinite(Number(row.tokenUsed)) ? Number(row.tokenUsed) : 0;
    const decision = String(row && row.decision ? row.decision : '').toLowerCase();
    if (decision !== 'allow') current.blocked += 1;
    map.set(userId, current);
  });
  return Array.from(map.values())
    .map((item) => Object.assign({}, item, {
      blockedRate: item.calls > 0 ? Math.round((item.blocked / item.calls) * 10000) / 10000 : 0
    }))
    .sort((a, b) => {
      if (b.calls !== a.calls) return b.calls - a.calls;
      if (b.tokens !== a.tokens) return b.tokens - a.tokens;
      return a.userId.localeCompare(b.userId, 'ja');
    })
    .slice(0, limit);
}

async function handleLlmUsageSummary(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  try {
    const url = new URL(req.url, 'http://localhost');
    const windowDays = parsePositiveInt(url.searchParams.get('windowDays'), 7, 1, 90);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 1, 100);
    const scanLimit = parsePositiveInt(url.searchParams.get('scanLimit'), 3000, 100, 5000);
    if (windowDays === null || limit === null || scanLimit === null) throw new Error('invalid limit');

    const toAt = new Date();
    const fromAt = new Date(Date.now() - ((windowDays - 1) * 24 * 60 * 60 * 1000));
    const rows = await llmUsageLogsRepo.listLlmUsageLogsByCreatedAtRange({
      fromAt,
      toAt,
      limit: scanLimit
    });

    const callsTotal = Array.isArray(rows) ? rows.length : 0;
    const tokensTotal = sumBy(rows, (row) => row && row.tokenUsed);
    const blockedCount = (rows || []).filter((row) => String(row && row.decision ? row.decision : '').toLowerCase() !== 'allow').length;
    const blockedRate = callsTotal > 0 ? Math.round((blockedCount / callsTotal) * 10000) / 10000 : 0;
    const proRows = (rows || []).filter((row) => String(row && row.plan ? row.plan : '').toLowerCase() === 'pro');
    const proAvgUsage = proRows.length > 0
      ? Math.round((proRows.length / Math.max(1, new Set(proRows.map((row) => String(row && row.userId ? row.userId : 'unknown'))).size)) * 100) / 100
      : 0;

    const summary = {
      windowDays,
      callsTotal,
      tokensTotal,
      blockedCount,
      blockedRate,
      proAvgUsage,
      byDay: buildDailySeries(rows, windowDays),
      blockedReasons: buildReasonBreakdown(rows),
      topUsers: buildTopUsers(rows, limit)
    };

    await appendAuditLog({
      actor,
      action: 'llm_usage.summary.view',
      entityType: 'llm_usage',
      entityId: `window_${windowDays}d`,
      traceId,
      requestId,
      payloadSummary: {
        windowDays,
        callsTotal,
        blockedRate,
        scanLimit,
        topUserCount: summary.topUsers.length
      }
    });

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      summary
    }));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.startsWith('invalid ')) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: message, traceId, requestId }));
      return;
    }
    logRouteError('admin.os_llm_usage_summary', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleLlmUsageSummary,
  buildDailySeries,
  buildReasonBreakdown,
  buildTopUsers
};
