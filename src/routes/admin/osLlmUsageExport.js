'use strict';

const llmUsageLogsRepo = require('../../repos/firestore/llmUsageLogsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { buildMaskedTopUsers } = require('./osLlmUsageSummary');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

function parsePositiveInt(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

function escapeCsvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(items) {
  const header = [
    'userIdMasked',
    'plan',
    'calls',
    'tokens',
    'blocked',
    'blockedRate'
  ];
  const rows = [header.join(',')];
  (Array.isArray(items) ? items : []).forEach((item) => {
    rows.push([
      item && item.userIdMasked ? item.userIdMasked : '',
      item && item.plan ? item.plan : 'free',
      Number.isFinite(Number(item && item.calls)) ? Number(item.calls) : 0,
      Number.isFinite(Number(item && item.tokens)) ? Number(item.tokens) : 0,
      Number.isFinite(Number(item && item.blocked)) ? Number(item.blocked) : 0,
      Number.isFinite(Number(item && item.blockedRate)) ? Number(item.blockedRate) : 0
    ].map(escapeCsvCell).join(','));
  });
  return `${rows.join('\n')}\n`;
}

async function handleLlmUsageExport(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  try {
    const url = new URL(req.url, 'http://localhost');
    const windowDays = parsePositiveInt(url.searchParams.get('windowDays'), 7, 1, 90);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 100, 1, 500);
    const scanLimit = parsePositiveInt(url.searchParams.get('scanLimit'), 3000, 100, 5000);
    if (windowDays === null || limit === null || scanLimit === null) throw new Error('invalid limit');

    const toAt = new Date();
    const fromAt = new Date(Date.now() - ((windowDays - 1) * 24 * 60 * 60 * 1000));
    const rows = await llmUsageLogsRepo.listLlmUsageLogsByCreatedAtRange({
      fromAt,
      toAt,
      limit: scanLimit
    });
    const maskedTopUsers = buildMaskedTopUsers(rows, limit);
    const csv = toCsv(maskedTopUsers);

    await appendAuditLog({
      actor,
      action: 'llm_usage.summary.export',
      entityType: 'llm_usage',
      entityId: `window_${windowDays}d`,
      traceId,
      requestId,
      payloadSummary: {
        windowDays,
        scanLimit,
        rowCount: maskedTopUsers.length,
        piiMasked: true
      }
    });

    const filename = `llm_usage_summary_${new Date().toISOString().slice(0, 10)}.csv`;
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
    logRouteError('admin.os_llm_usage_export', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleLlmUsageExport,
  toCsv
};
