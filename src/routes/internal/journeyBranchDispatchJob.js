'use strict';

const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { runJourneyBranchDispatchJob } = require('../../usecases/journey/runJourneyBranchDispatchJob');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_KEY = 'internal_journey_branch_dispatch_job';

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
  const header = req && req.headers ? req.headers['x-journey-branch-job-token'] : null;
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req && req.headers ? req.headers.authorization : null;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  return '';
}

function requireJourneyBranchJobToken(req, res) {
  const expected = process.env.JOURNEY_BRANCH_JOB_TOKEN || '';
  if (!expected) {
    writeJson(res, 503, { ok: false, error: 'JOURNEY_BRANCH_JOB_TOKEN not configured' }, {
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

async function handleJourneyBranchDispatchJob(req, res, bodyText, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getKillSwitchFn = resolvedDeps.getKillSwitch || getKillSwitch;
  const runJourneyBranchDispatchJobFn = resolvedDeps.runJourneyBranchDispatchJob || runJourneyBranchDispatchJob;
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  if (!requireJourneyBranchJobToken(req, res)) return;

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

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : null;

  const result = await runJourneyBranchDispatchJobFn({
    dryRun: payload.dryRun,
    limit: payload.limit,
    now: payload.now,
    traceId: traceIdHeader || payload.traceId || null,
    actor: 'journey_branch_dispatch_job',
    requestId: payload.requestId || null
  });

  let state = 'success';
  let reason = 'completed';
  if (result && result.status === 'disabled_by_flag') {
    state = 'blocked';
    reason = 'disabled_by_flag';
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

  writeJson(res, 200, result, {
    state,
    reason,
    guard: { routeKey: ROUTE_KEY, decision: 'allow' }
  });
}

module.exports = {
  handleJourneyBranchDispatchJob,
  requireJourneyBranchJobToken
};
