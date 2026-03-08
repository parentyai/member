'use strict';

const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { runJourneyTodoReminderJob } = require('../../usecases/journey/runJourneyTodoReminderJob');
const { attachOutcome, applyOutcomeHeaders, inferOutcomeState } = require('../../domain/routeOutcomeContract');

function writeJson(res, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, Object.assign({
    routeType: 'internal_job',
    guard: { routeKey: 'internal_journey_todo_reminder_job' }
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
  const header = req && req.headers ? req.headers['x-journey-job-token'] : null;
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req && req.headers ? req.headers.authorization : null;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  return '';
}

function requireJourneyJobToken(req, res) {
  const expected = process.env.JOURNEY_JOB_TOKEN || '';
  if (!expected) {
    writeJson(res, 503, { ok: false, error: 'JOURNEY_JOB_TOKEN not configured' }, {
      state: 'error',
      reason: 'job_token_not_configured',
      guard: { routeKey: 'internal_journey_todo_reminder_job', decision: 'block' }
    });
    return false;
  }
  const actual = resolveToken(req);
  if (!actual || actual !== expected) {
    writeJson(res, 401, { ok: false, error: 'unauthorized' }, {
      state: 'blocked',
      reason: 'unauthorized',
      guard: { routeKey: 'internal_journey_todo_reminder_job', decision: 'block' }
    });
    return false;
  }
  return true;
}

async function handleJourneyTodoReminderJob(req, res, bodyText) {
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found',
      guard: { routeKey: 'internal_journey_todo_reminder_job', decision: 'block' }
    });
    return;
  }
  if (!requireJourneyJobToken(req, res)) return;

  const killSwitch = await getKillSwitch();
  if (killSwitch) {
    writeJson(res, 409, { ok: false, error: 'kill switch on' }, {
      state: 'blocked',
      reason: 'kill_switch_on',
      guard: {
        routeKey: 'internal_journey_todo_reminder_job',
        decision: 'block',
        killSwitchOn: true
      }
    });
    return;
  }

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' }, {
      state: 'error',
      reason: 'invalid_json',
      guard: { routeKey: 'internal_journey_todo_reminder_job', decision: 'block' }
    });
    return;
  }

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : null;

  const result = await runJourneyTodoReminderJob({
    runId: payload.runId,
    dryRun: payload.dryRun,
    limit: payload.limit,
    now: payload.now,
    traceId: traceIdHeader || payload.traceId || null,
    actor: 'journey_todo_reminder_job',
    requestId: payload.requestId || null
  });

  const statusCode = result && result.partialFailure === true ? 207 : 200;
  const state = inferOutcomeState(result, {
    state: result && result.partialFailure === true ? 'partial' : 'success'
  });
  writeJson(res, statusCode, result, {
    state,
    reason: result && result.status ? result.status : (state === 'partial' ? 'completed_with_failures' : 'completed'),
    guard: { routeKey: 'internal_journey_todo_reminder_job', decision: 'allow' }
  });
}

module.exports = {
  handleJourneyTodoReminderJob,
  requireJourneyJobToken
};
