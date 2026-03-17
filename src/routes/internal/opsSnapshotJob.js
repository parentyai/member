'use strict';

const { buildOpsSnapshots } = require('../../usecases/admin/buildOpsSnapshots');
const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_KEY = 'internal_ops_snapshot_build_job';

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

async function handleOpsSnapshotJob(req, res, bodyText, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getKillSwitchFn = resolvedDeps.getKillSwitch || getKillSwitch;
  const buildOpsSnapshotsFn = resolvedDeps.buildOpsSnapshots || buildOpsSnapshots;
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

  const killSwitch = await getKillSwitchFn();
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

  const result = await buildOpsSnapshotsFn({
    dryRun: payload.dryRun === true,
    scanLimit: payload.scanLimit,
    windowMonths: payload.windowMonths,
    targets: payload.targets,
    lineUserIds: payload.lineUserIds,
    traceId,
    requestId: payload.requestId || null,
    actor: 'ops_snapshot_job'
  });

  let state = 'success';
  let reason = payload.dryRun === true ? 'dry_run' : 'completed';
  if (Array.isArray(result && result.summary && result.summary.skippedTargets) && result.summary.skippedTargets.length > 0) {
    state = 'partial';
    reason = 'completed_with_skips';
  }
  writeJson(res, 200, result, {
    state,
    reason,
    guard: { routeKey: ROUTE_KEY, decision: 'allow' }
  });
}

module.exports = {
  handleOpsSnapshotJob
};
