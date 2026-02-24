'use strict';

const { getUsersSummaryFiltered } = require('../../usecases/phase5/getUsersSummaryFiltered');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

function parsePositiveInt(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

function parsePlan(value) {
  if (!value || value === 'all') return null;
  if (value === 'free' || value === 'pro') return value;
  return null;
}

function parseStatus(value) {
  if (!value || value === 'all') return null;
  if (['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unknown'].includes(value)) return value;
  return null;
}

function parseQuickFilter(value) {
  if (!value) return null;
  if (['all', 'pro_active', 'free', 'trialing', 'past_due', 'canceled', 'unknown'].includes(value)) return value;
  return null;
}

function parseBillingIntegrity(value) {
  if (!value || value === 'all') return null;
  if (['ok', 'unknown', 'conflict'].includes(value)) return value;
  return null;
}

function buildSummary(items) {
  const list = Array.isArray(items) ? items : [];
  const byPlan = { free: 0, pro: 0 };
  const byStatus = {
    active: 0,
    trialing: 0,
    past_due: 0,
    canceled: 0,
    incomplete: 0,
    unknown: 0
  };
  const byIntegrity = { ok: 0, unknown: 0, conflict: 0 };

  list.forEach((item) => {
    const plan = item && item.plan === 'pro' ? 'pro' : 'free';
    byPlan[plan] += 1;

    const status = item && typeof item.subscriptionStatus === 'string' ? item.subscriptionStatus : 'unknown';
    if (Object.prototype.hasOwnProperty.call(byStatus, status)) byStatus[status] += 1;
    else byStatus.unknown += 1;

    const integrity = item && typeof item.billingIntegrityState === 'string' ? item.billingIntegrityState : 'unknown';
    if (Object.prototype.hasOwnProperty.call(byIntegrity, integrity)) byIntegrity[integrity] += 1;
    else byIntegrity.unknown += 1;
  });

  const total = list.length;
  const proActiveCount = list.filter((item) => item && item.plan === 'pro').length;
  const proActiveRatio = total > 0 ? Number((proActiveCount / total).toFixed(4)) : 0;
  const unknownCount = byStatus.unknown + byIntegrity.conflict + byIntegrity.unknown;
  const unknownRatio = total > 0 ? Number((unknownCount / total).toFixed(4)) : 0;

  return {
    total,
    proActiveCount,
    proActiveRatio,
    unknownCount,
    unknownRatio,
    byPlan,
    byStatus,
    byIntegrity
  };
}

async function handleUsersSummaryAnalyze(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  try {
    const url = new URL(req.url, 'http://localhost');
    const limit = parsePositiveInt(url.searchParams.get('limit'), 200, 1, 500);
    const analyticsLimit = parsePositiveInt(url.searchParams.get('analyticsLimit'), 1200, 1, 3000);
    const plan = parsePlan(url.searchParams.get('plan'));
    const subscriptionStatus = parseStatus(url.searchParams.get('subscriptionStatus'));
    const quickFilter = parseQuickFilter(url.searchParams.get('quickFilter'));
    const billingIntegrity = parseBillingIntegrity(url.searchParams.get('billingIntegrity'));
    if (limit === null || analyticsLimit === null) throw new Error('invalid limit');
    if (url.searchParams.get('plan') && !plan) throw new Error('invalid plan');
    if (url.searchParams.get('subscriptionStatus') && !subscriptionStatus) throw new Error('invalid subscriptionStatus');
    if (url.searchParams.get('quickFilter') && !quickFilter) throw new Error('invalid quickFilter');
    if (url.searchParams.get('billingIntegrity') && !billingIntegrity) throw new Error('invalid billingIntegrity');

    const summary = await getUsersSummaryFiltered({
      limit,
      analyticsLimit,
      plan,
      subscriptionStatus,
      quickFilter,
      billingIntegrity,
      sortKey: url.searchParams.get('sortKey') || null,
      sortDir: url.searchParams.get('sortDir') || null
    });

    const items = Array.isArray(summary) ? summary : (Array.isArray(summary && summary.items) ? summary.items : []);
    const analyze = buildSummary(items);

    await appendAuditLog({
      actor,
      action: 'users_summary.analyze',
      entityType: 'read_model',
      entityId: 'users_summary',
      traceId,
      requestId,
      payloadSummary: {
        total: analyze.total,
        proActiveCount: analyze.proActiveCount,
        unknownRatio: analyze.unknownRatio,
        filters: {
          plan: plan || 'all',
          subscriptionStatus: subscriptionStatus || 'all',
          quickFilter: quickFilter || 'all',
          billingIntegrity: billingIntegrity || 'all'
        }
      }
    });

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      analyze
    }));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.startsWith('invalid ')) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: message, traceId, requestId }));
      return;
    }
    logRouteError('admin.os_users_summary_analyze', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleUsersSummaryAnalyze
};
