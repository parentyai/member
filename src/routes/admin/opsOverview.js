'use strict';

const { getUserOperationalSummary } = require('../../usecases/admin/getUserOperationalSummary');
const { getNotificationOperationalSummary } = require('../../usecases/admin/getNotificationOperationalSummary');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  normalizeFallbackMode,
  resolveFallbackModeDefault
} = require('../../domain/readModel/fallbackPolicy');

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (
    message.includes('required') ||
    message.includes('invalid limit') ||
    message.includes('invalid snapshotMode') ||
    message.includes('invalid fallbackMode')
  ) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(message);
    return;
  }
  res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('error');
}

function parsePositiveInt(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

function parseSnapshotMode(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value === 'prefer' || value === 'require') return value;
  return null;
}

function parseFallbackMode(value) {
  if (value === null || value === undefined || value === '') return resolveFallbackModeDefault();
  const normalized = normalizeFallbackMode(value);
  if (normalized) return normalized;
  return null;
}

function resolveHeader(req, key) {
  if (!req || !req.headers) return null;
  const value = req.headers[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function resolveAuditActor(req) {
  return resolveHeader(req, 'x-actor') || 'admin_api';
}

async function appendFallbackAudit(req, action, meta, extra) {
  if (!meta) return;
  const fallbackUsed = Boolean(meta.fallbackUsed);
  const fallbackBlocked = Boolean(meta.fallbackBlocked);
  if (!fallbackUsed && !fallbackBlocked) return;
  try {
    await appendAuditLog({
      actor: resolveAuditActor(req),
      action,
      entityType: 'read_path',
      entityId: 'summary',
      traceId: resolveHeader(req, 'x-trace-id') || undefined,
      requestId: resolveHeader(req, 'x-request-id') || undefined,
      payloadSummary: Object.assign({
        fallbackUsed,
        fallbackBlocked,
        fallbackSources: Array.isArray(meta.fallbackSources) ? meta.fallbackSources : []
      }, extra || {})
    });
  } catch (_err) {
    // best effort only
  }
}

async function handleUsersSummary(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const limitRaw = url.searchParams.get('limit');
    const analyticsLimitRaw = url.searchParams.get('analyticsLimit');
    const snapshotModeRaw = url.searchParams.get('snapshotMode');
    const fallbackModeRaw = url.searchParams.get('fallbackMode');
    const limit = parsePositiveInt(limitRaw, 1, 500);
    const analyticsLimit = parsePositiveInt(analyticsLimitRaw, 1, 3000);
    const snapshotMode = parseSnapshotMode(snapshotModeRaw);
    const fallbackMode = parseFallbackMode(fallbackModeRaw);
    if ((limitRaw && !limit) || (analyticsLimitRaw && !analyticsLimit)) {
      throw new Error('invalid limit');
    }
    if (snapshotModeRaw && !snapshotMode) {
      throw new Error('invalid snapshotMode');
    }
    if (fallbackModeRaw && !fallbackMode) {
      throw new Error('invalid fallbackMode');
    }
    const items = await getUserOperationalSummary({
      limit,
      analyticsLimit,
      snapshotMode,
      fallbackMode,
      includeMeta: true
    });
    const normalizedItems = Array.isArray(items) ? items : (Array.isArray(items.items) ? items.items : []);
    const meta = items && !Array.isArray(items) && items.meta ? items.meta : null;
    await appendFallbackAudit(req, 'read_path.fallback.users_summary', meta, {
      scope: 'phase4_users_summary',
      snapshotMode: snapshotMode || null,
      fallbackMode
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      items: normalizedItems,
      dataSource: meta && meta.dataSource ? meta.dataSource : null,
      asOf: meta && Object.prototype.hasOwnProperty.call(meta, 'asOf') ? meta.asOf : null,
      freshnessMinutes: meta && Object.prototype.hasOwnProperty.call(meta, 'freshnessMinutes') ? meta.freshnessMinutes : null,
      fallbackUsed: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackUsed') ? meta.fallbackUsed : false,
      fallbackBlocked: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackBlocked') ? meta.fallbackBlocked : false,
      fallbackSources: meta && Array.isArray(meta.fallbackSources) ? meta.fallbackSources : []
    }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleNotificationsSummary(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const limitRaw = url.searchParams.get('limit');
  const eventsLimitRaw = url.searchParams.get('eventsLimit');
  const snapshotModeRaw = url.searchParams.get('snapshotMode');
  const fallbackModeRaw = url.searchParams.get('fallbackMode');
  const status = url.searchParams.get('status');
  const scenarioKey = url.searchParams.get('scenarioKey');
  const stepKey = url.searchParams.get('stepKey');
  try {
    const limit = parsePositiveInt(limitRaw, 1, 500);
    const eventsLimit = parsePositiveInt(eventsLimitRaw, 1, 3000);
    const snapshotMode = parseSnapshotMode(snapshotModeRaw);
    const fallbackMode = parseFallbackMode(fallbackModeRaw);
    if ((limitRaw && !limit) || (eventsLimitRaw && !eventsLimit)) {
      throw new Error('invalid limit');
    }
    if (snapshotModeRaw && !snapshotMode) {
      throw new Error('invalid snapshotMode');
    }
    if (fallbackModeRaw && !fallbackMode) {
      throw new Error('invalid fallbackMode');
    }
    const summary = await getNotificationOperationalSummary({
      limit,
      eventsLimit,
      snapshotMode,
      fallbackMode,
      includeMeta: true,
      status: status || undefined,
      scenarioKey: scenarioKey || undefined,
      stepKey: stepKey || undefined
    });
    const items = Array.isArray(summary) ? summary : (Array.isArray(summary.items) ? summary.items : []);
    const meta = summary && !Array.isArray(summary) && summary.meta ? summary.meta : null;
    await appendFallbackAudit(req, 'read_path.fallback.notifications_summary', meta, {
      scope: 'phase4_notifications_summary',
      snapshotMode: snapshotMode || null,
      fallbackMode
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      items,
      dataSource: meta && meta.dataSource ? meta.dataSource : null,
      asOf: meta && Object.prototype.hasOwnProperty.call(meta, 'asOf') ? meta.asOf : null,
      freshnessMinutes: meta && Object.prototype.hasOwnProperty.call(meta, 'freshnessMinutes') ? meta.freshnessMinutes : null,
      fallbackUsed: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackUsed') ? meta.fallbackUsed : false,
      fallbackBlocked: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackBlocked') ? meta.fallbackBlocked : false,
      fallbackSources: meta && Array.isArray(meta.fallbackSources) ? meta.fallbackSources : []
    }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleUsersSummary,
  handleNotificationsSummary
};
