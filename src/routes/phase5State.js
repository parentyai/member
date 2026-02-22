'use strict';

const { getUserStateSummary } = require('../usecases/phase5/getUserStateSummary');
const { appendAuditLog } = require('../usecases/audit/appendAuditLog');
const {
  normalizeFallbackMode,
  resolveFallbackModeDefault
} = require('../domain/readModel/fallbackPolicy');

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (
    message.includes('required') ||
    message.includes('not found') ||
    message.includes('invalid limit') ||
    message.includes('invalid snapshotMode') ||
    message.includes('invalid fallbackMode') ||
    message.includes('invalid fallbackOnEmpty')
  ) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
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

function parseFallbackOnEmpty(value) {
  if (value === null || value === undefined || value === '') return true;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function resolveHeader(req, key) {
  if (!req || !req.headers) return null;
  const value = req.headers[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function resolveAuditActor(req) {
  return resolveHeader(req, 'x-actor') || 'phase5_api';
}

async function appendFallbackAudit(req, meta, extra) {
  if (!meta) return;
  const fallbackUsed = Boolean(meta.fallbackUsed);
  const fallbackBlocked = Boolean(meta.fallbackBlocked);
  if (!fallbackUsed && !fallbackBlocked) return;
  try {
    await appendAuditLog({
      actor: resolveAuditActor(req),
      action: 'read_path.fallback.phase5_state',
      entityType: 'read_path',
      entityId: 'phase5_state',
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

async function handleUserStateSummary(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  try {
    const analyticsLimitRaw = url.searchParams.get('analyticsLimit');
    const snapshotModeRaw = url.searchParams.get('snapshotMode');
    const fallbackModeRaw = url.searchParams.get('fallbackMode');
    const fallbackOnEmptyRaw = url.searchParams.get('fallbackOnEmpty');
    const analyticsLimit = parsePositiveInt(analyticsLimitRaw, 1, 3000);
    const snapshotMode = parseSnapshotMode(snapshotModeRaw);
    const fallbackMode = parseFallbackMode(fallbackModeRaw);
    const fallbackOnEmpty = parseFallbackOnEmpty(fallbackOnEmptyRaw);
    if (analyticsLimitRaw && !analyticsLimit) {
      throw new Error('invalid limit');
    }
    if (snapshotModeRaw && !snapshotMode) {
      throw new Error('invalid snapshotMode');
    }
    if (fallbackModeRaw && !fallbackMode) {
      throw new Error('invalid fallbackMode');
    }
    if (fallbackOnEmptyRaw && fallbackOnEmpty === null) {
      throw new Error('invalid fallbackOnEmpty');
    }
    const result = await getUserStateSummary({
      lineUserId,
      analyticsLimit,
      snapshotMode,
      fallbackMode,
      fallbackOnEmpty,
      includeMeta: true
    });
    const item = result && typeof result === 'object' && !Array.isArray(result) && result.item ? result.item : result;
    const meta = result && typeof result === 'object' && !Array.isArray(result) && result.meta ? result.meta : null;
    await appendFallbackAudit(req, meta, {
      scope: 'phase5_state_summary',
      snapshotMode: snapshotMode || null,
      fallbackMode,
      fallbackOnEmpty,
      lineUserId: lineUserId || null
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      item,
      dataSource: meta && meta.dataSource ? meta.dataSource : null,
      asOf: meta && Object.prototype.hasOwnProperty.call(meta, 'asOf') ? meta.asOf : null,
      freshnessMinutes: meta && Object.prototype.hasOwnProperty.call(meta, 'freshnessMinutes') ? meta.freshnessMinutes : null,
      fallbackUsed: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackUsed') ? meta.fallbackUsed : false,
      fallbackBlocked: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackBlocked') ? meta.fallbackBlocked : false,
      fallbackSources: meta && Array.isArray(meta.fallbackSources) ? meta.fallbackSources : [],
      fallbackOnEmpty
    }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleUserStateSummary
};
