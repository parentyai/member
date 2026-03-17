'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const { buildUserContextSnapshot } = require('../../usecases/context/buildUserContextSnapshot');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_KEY = 'internal_user_context_snapshot_build_job';

function writeJson(res, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, Object.assign({
    routeType: 'internal_job',
    guard: { routeKey: ROUTE_KEY }
  }, outcomeOptions || {}));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseJson(bodyText) {
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_err) {
    return null;
  }
}

function resolveEnabled() {
  const raw = process.env.ENABLE_USER_CONTEXT_SNAPSHOT;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
}

function resolveLineUserIds(payload) {
  const out = [];
  const single = payload && typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
  if (single) out.push(single);
  const list = Array.isArray(payload && payload.lineUserIds) ? payload.lineUserIds : [];
  list.forEach((item) => {
    if (typeof item !== 'string') return;
    const id = item.trim();
    if (!id || out.includes(id)) return;
    out.push(id);
  });
  return out;
}

function resolveLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return 100;
  return Math.min(Math.floor(num), 1000);
}

async function handleUserContextSnapshotJob(req, res, bodyText) {
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  if (!requireInternalJobToken(req, res, {
    routeType: 'internal_job',
    guard: { routeKey: ROUTE_KEY }
  })) return;
  if (!resolveEnabled()) {
    writeJson(res, 503, { ok: false, error: 'user_context_snapshot_disabled' }, {
      state: 'blocked',
      reason: 'user_context_snapshot_disabled',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const killSwitch = await getKillSwitch();
  if (killSwitch) {
    writeJson(res, 409, { ok: false, error: 'kill switch on' }, {
      state: 'blocked',
      reason: 'kill_switch_on',
      guard: { routeKey: ROUTE_KEY, decision: 'block', killSwitchOn: true }
    });
    return;
  }

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' }, {
      state: 'error',
      reason: 'invalid_json',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const traceId = req.headers && typeof req.headers['x-trace-id'] === 'string' && req.headers['x-trace-id'].trim()
    ? req.headers['x-trace-id'].trim()
    : (typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null);

  let lineUserIds = resolveLineUserIds(payload);
  if (!lineUserIds.length) {
    const users = await usersRepo.listUsers({ limit: resolveLimit(payload.limit) });
    lineUserIds = users.map((user) => user && user.id).filter(Boolean);
  }

  const dryRun = payload.dryRun === true;
  const items = [];
  for (const lineUserId of lineUserIds) {
    // eslint-disable-next-line no-await-in-loop
    const result = await buildUserContextSnapshot({
      lineUserId,
      write: !dryRun,
      traceId,
      actor: 'user_context_snapshot_job',
      requestId: payload.requestId || null,
      updatedAt: payload.updatedAt || null
    });
    items.push({
      lineUserId,
      ok: result.ok === true,
      reason: result.reason || null,
      droppedSummary: result.droppedSummary || null
    });
  }

  const processed = items.length;
  const updated = items.filter((item) => item.ok).length;
  const skipped = processed - updated;
  const state = skipped > 0 ? 'partial' : 'success';

  writeJson(res, 200, {
    ok: true,
    dryRun,
    traceId,
    processed,
    updated,
    skipped,
    items
  }, {
    state,
    reason: state === 'partial' ? 'completed_with_skips' : 'completed',
    guard: { routeKey: ROUTE_KEY, decision: 'allow' }
  });
}

module.exports = {
  handleUserContextSnapshotJob
};
