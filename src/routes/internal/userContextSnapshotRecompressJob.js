'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { buildUserContextSnapshot } = require('../../usecases/context/buildUserContextSnapshot');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseJson(bodyText) {
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_err) {
    return null;
  }
}

function resolveEnabled() {
  const raw = process.env.ENABLE_CONTEXT_SNAPSHOT_V2;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
}

function resolveLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return 100;
  return Math.min(Math.floor(num), 2000);
}

function resolveLineUserIds(payload) {
  const out = [];
  const single = payload && typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
  if (single) out.push(single);
  const list = Array.isArray(payload && payload.lineUserIds) ? payload.lineUserIds : [];
  list.forEach((item) => {
    if (typeof item !== 'string') return;
    const normalized = item.trim();
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

async function handleUserContextSnapshotRecompressJob(req, res, bodyText) {
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireInternalJobToken(req, res)) return;
  if (!resolveEnabled()) {
    writeJson(res, 503, { ok: false, error: 'context_snapshot_v2_disabled' });
    return;
  }

  const killSwitch = await getKillSwitch();
  if (killSwitch) {
    writeJson(res, 409, { ok: false, error: 'kill switch on' });
    return;
  }

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' });
    return;
  }

  const traceId = req.headers && typeof req.headers['x-trace-id'] === 'string' && req.headers['x-trace-id'].trim()
    ? req.headers['x-trace-id'].trim()
    : (typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null);

  let lineUserIds = resolveLineUserIds(payload);
  if (!lineUserIds.length) {
    const users = await usersRepo.listUsers({ limit: resolveLimit(payload.limit) });
    lineUserIds = users.map((row) => row && row.id).filter(Boolean);
  }

  const dryRun = payload.dryRun === true;
  const items = [];
  for (const lineUserId of lineUserIds) {
    // eslint-disable-next-line no-await-in-loop
    const result = await buildUserContextSnapshot({
      lineUserId,
      write: !dryRun,
      recompressed: true,
      actor: payload.actor || 'snapshot_recompress_job',
      traceId,
      requestId: payload.requestId || null,
      updatedAt: payload.updatedAt || null
    });
    items.push({
      lineUserId,
      ok: result && result.ok === true,
      reason: result && result.reason ? result.reason : null,
      droppedSummary: result && result.droppedSummary ? result.droppedSummary : null
    });
  }

  const processed = items.length;
  const updated = items.filter((item) => item.ok).length;
  const skipped = processed - updated;

  writeJson(res, 200, {
    ok: true,
    dryRun,
    traceId,
    processed,
    updated,
    skipped,
    items
  });
}

module.exports = {
  handleUserContextSnapshotRecompressJob
};
