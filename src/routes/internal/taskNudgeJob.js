'use strict';

const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { runTaskNudgeJob } = require('../../usecases/tasks/runTaskNudgeJob');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_KEY = 'internal_task_nudge_job';

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

function resolveToken(req) {
  const header = req && req.headers ? req.headers['x-task-job-token'] : null;
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req && req.headers ? req.headers.authorization : null;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  return '';
}

function requireTaskJobToken(req, res) {
  const expected = process.env.TASK_JOB_TOKEN || '';
  if (!expected) {
    writeJson(res, 503, { ok: false, error: 'TASK_JOB_TOKEN not configured' }, {
      state: 'error',
      reason: 'job_token_not_configured',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return false;
  }
  const actual = resolveToken(req);
  if (!actual || actual !== expected) {
    writeJson(res, 401, { ok: false, error: 'unauthorized' }, {
      state: 'blocked',
      reason: 'unauthorized',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return false;
  }
  return true;
}

async function handleTaskNudgeJob(req, res, bodyText, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getKillSwitchFn = resolvedDeps.getKillSwitch || getKillSwitch;
  const runTaskNudgeJobFn = resolvedDeps.runTaskNudgeJob || runTaskNudgeJob;
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  if (!requireTaskJobToken(req, res)) return;

  let killSwitch = false;
  try {
    killSwitch = await getKillSwitchFn();
  } catch (_err) {
    writeJson(res, 503, { ok: false, error: 'temporarily unavailable', reason: 'kill_switch_read_failed' }, {
      state: 'blocked',
      reason: 'kill_switch_read_failed',
      guard: { routeKey: ROUTE_KEY, decision: 'block', readError: true }
    });
    return;
  }
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

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : null;

  const result = await runTaskNudgeJobFn({
    dryRun: payload.dryRun,
    limit: payload.limit,
    now: payload.now,
    traceId: traceIdHeader || payload.traceId || null,
    requestId: payload.requestId || null,
    actor: payload.actor || 'task_nudge_job'
  });

  let statusCode = 200;
  let state = 'success';
  let reason = 'completed';
  if (result && result.ok === false) {
    if (result.status === 'blocked_by_killswitch_read_failed') {
      statusCode = 503;
      state = 'blocked';
      reason = 'kill_switch_read_failed';
    } else if (result.status === 'blocked_by_killswitch') {
      statusCode = 409;
      state = 'blocked';
      reason = 'kill_switch_on';
    } else {
      statusCode = 409;
      state = 'partial';
      reason = 'completed_with_failures';
    }
  } else if (result && result.status === 'disabled_by_env') {
    state = 'blocked';
    reason = 'disabled_by_env';
  } else if (result && result.dryRun === true) {
    state = 'success';
    reason = 'dry_run';
  } else if (Number(result && result.failedCount) > 0) {
    state = 'partial';
    reason = 'completed_with_failures';
  } else if (Number(result && result.skippedCount) > 0) {
    state = 'partial';
    reason = 'completed_with_skips';
  }
  writeJson(res, statusCode, result, {
    state,
    reason,
    guard: {
      routeKey: ROUTE_KEY,
      decision: state === 'blocked' || state === 'error' ? 'block' : 'allow'
    }
  });
}

module.exports = {
  handleTaskNudgeJob,
  requireTaskJobToken
};
