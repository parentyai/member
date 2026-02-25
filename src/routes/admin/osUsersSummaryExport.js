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

function parseSortKey(value) {
  if (!value) return null;
  if ([
    'createdAt',
    'updatedAt',
    'currentPeriodEnd',
    'lineUserId',
    'memberNumber',
    'category',
    'status',
    'deliveryCount',
    'clickCount',
    'reactionRate',
    'plan',
    'subscriptionStatus',
    'llmUsage',
    'llmUsageToday',
    'tokensToday',
    'blockedRate',
    'billingIntegrity'
  ].includes(value)) {
    return value;
  }
  return null;
}

function parseSortDir(value) {
  if (!value) return null;
  if (value === 'asc' || value === 'desc') return value;
  return null;
}

function escapeCsvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function maskLineUserId(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (text.length <= 6) return `${text.slice(0, 1)}***${text.slice(-1)}`;
  return `${text.slice(0, 3)}***${text.slice(-2)}`;
}

function maskMemberNumber(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (text.length <= 4) return '**';
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function toCsv(items) {
  const header = [
    'lineUserIdMasked',
    'memberNumberMasked',
    'plan',
    'subscriptionStatus',
    'billingIntegrityState',
    'currentPeriodEnd',
    'updatedAt',
    'llmUsageToday',
    'llmTokenUsedToday',
    'llmBlockedToday',
    'llmBlockedRate',
    'deliveryCount',
    'clickCount',
    'reactionRate',
    'categoryLabel',
    'statusLabel'
  ];
  const rows = [header.join(',')];
  (Array.isArray(items) ? items : []).forEach((item) => {
    rows.push([
      maskLineUserId(item && item.lineUserId),
      maskMemberNumber(item && item.memberNumber),
      item && item.plan ? item.plan : 'free',
      item && item.subscriptionStatus ? item.subscriptionStatus : 'unknown',
      item && item.billingIntegrityState ? item.billingIntegrityState : 'unknown',
      item && item.currentPeriodEnd ? item.currentPeriodEnd : '',
      item && item.updatedAt ? item.updatedAt : '',
      Number.isFinite(Number(item && item.llmUsageToday)) ? Number(item.llmUsageToday) : 0,
      Number.isFinite(Number(item && item.llmTokenUsedToday)) ? Number(item.llmTokenUsedToday) : 0,
      Number.isFinite(Number(item && item.llmBlockedToday)) ? Number(item.llmBlockedToday) : 0,
      Number.isFinite(Number(item && item.llmBlockedRate)) ? Number(item.llmBlockedRate) : 0,
      Number.isFinite(Number(item && item.deliveryCount)) ? Number(item.deliveryCount) : 0,
      Number.isFinite(Number(item && item.clickCount)) ? Number(item.clickCount) : 0,
      Number.isFinite(Number(item && item.reactionRate)) ? Number(item.reactionRate) : '',
      item && item.categoryLabel ? item.categoryLabel : '',
      item && item.statusLabel ? item.statusLabel : ''
    ].map(escapeCsvCell).join(','));
  });
  return `${rows.join('\n')}\n`;
}

async function handleUsersSummaryExport(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  try {
    const url = new URL(req.url, 'http://localhost');
    const limit = parsePositiveInt(url.searchParams.get('limit'), 500, 1, 500);
    const analyticsLimit = parsePositiveInt(url.searchParams.get('analyticsLimit'), 1200, 1, 3000);
    const plan = parsePlan(url.searchParams.get('plan'));
    const subscriptionStatus = parseStatus(url.searchParams.get('subscriptionStatus'));
    const quickFilter = parseQuickFilter(url.searchParams.get('quickFilter'));
    const billingIntegrity = parseBillingIntegrity(url.searchParams.get('billingIntegrity'));
    const sortKey = parseSortKey(url.searchParams.get('sortKey'));
    const sortDir = parseSortDir(url.searchParams.get('sortDir'));

    if (limit === null || analyticsLimit === null) throw new Error('invalid limit');
    if (url.searchParams.get('plan') && !plan) throw new Error('invalid plan');
    if (url.searchParams.get('subscriptionStatus') && !subscriptionStatus) throw new Error('invalid subscriptionStatus');
    if (url.searchParams.get('quickFilter') && !quickFilter) throw new Error('invalid quickFilter');
    if (url.searchParams.get('billingIntegrity') && !billingIntegrity) throw new Error('invalid billingIntegrity');
    if (url.searchParams.get('sortKey') && !sortKey) throw new Error('invalid sortKey');
    if (url.searchParams.get('sortDir') && !sortDir) throw new Error('invalid sortDir');
    if (sortDir && !sortKey) throw new Error('invalid sortKey');

    const summary = await getUsersSummaryFiltered({
      limit,
      analyticsLimit,
      plan,
      subscriptionStatus,
      quickFilter,
      billingIntegrity,
      sortKey: sortKey || null,
      sortDir: sortDir || null
    });
    const items = Array.isArray(summary) ? summary : (Array.isArray(summary && summary.items) ? summary.items : []);
    const csv = toCsv(items);

    await appendAuditLog({
      actor,
      action: 'users_summary.export',
      entityType: 'read_model',
      entityId: 'users_summary',
      traceId,
      requestId,
      payloadSummary: {
        rowCount: items.length,
        filters: {
          plan: plan || 'all',
          subscriptionStatus: subscriptionStatus || 'all',
          quickFilter: quickFilter || 'all',
          billingIntegrity: billingIntegrity || 'all'
        },
        sort: {
          sortKey: sortKey || null,
          sortDir: sortDir || null
        },
        piiMasked: true
      }
    });

    const filename = `users_summary_${new Date().toISOString().slice(0, 10)}.csv`;
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store'
    });
    res.end(csv);
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.startsWith('invalid ')) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: message, traceId, requestId }));
      return;
    }
    logRouteError('admin.os_users_summary_export', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleUsersSummaryExport,
  maskLineUserId,
  maskMemberNumber,
  toCsv
};
