'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function normalizeSeedTag(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || 'dummy';
}

function normalizeSeedRunId(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || '';
}

function normalizeReason(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? raw.slice(0, 200) : '';
}

function normalizeLimit(value) {
  if (value === null || value === undefined || value === '') return 1000;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.max(1, Math.min(2000, Math.floor(num)));
}

function hasArchivedAt(row) {
  if (!row || typeof row !== 'object') return false;
  const value = row.seedArchivedAt;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

async function handleSeedArchive(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;
  const seedTag = normalizeSeedTag(payload.seedTag);
  const seedRunId = normalizeSeedRunId(payload.seedRunId);
  const reason = normalizeReason(payload.reason);
  const limit = normalizeLimit(payload.limit);
  if (!limit) {
    writeJson(res, 400, { ok: false, error: 'limit invalid', traceId, requestId });
    return;
  }
  try {
    const rows = await notificationsRepo.listNotificationsBySeedTag({
      seedTag,
      seedRunId: seedRunId || undefined,
      limit,
      includeArchivedSeed: true
    });
    const targets = rows.filter((row) => !hasArchivedAt(row)).map((row) => row.id).filter(Boolean);
    const checkedAt = new Date().toISOString();
    if (targets.length > 0) {
      await notificationsRepo.markNotificationsSeedArchived({
        ids: targets,
        patch: {
          seedArchivedAt: checkedAt,
          seedArchivedBy: actor,
          seedArchiveReason: reason || 'manual'
        }
      });
    }
    await appendAuditLog({
      actor,
      action: 'notifications.seed.archive',
      entityType: 'notification',
      entityId: seedRunId || seedTag,
      traceId,
      requestId,
      payloadSummary: {
        checkedAt,
        seedTag,
        seedRunId: seedRunId || null,
        matchedCount: rows.length,
        archivedCount: targets.length,
        reason: reason || null
      }
    });
    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      checkedAt,
      seedTag,
      seedRunId: seedRunId || null,
      matchedCount: rows.length,
      archivedCount: targets.length
    });
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('invalid')) {
      writeJson(res, 400, { ok: false, error: message, traceId, requestId });
      return;
    }
    logRouteError('admin.os_notification_seed_archive', err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId });
  }
}

module.exports = {
  handleSeedArchive
};
