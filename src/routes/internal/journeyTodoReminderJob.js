'use strict';

const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { runJourneyTodoReminderJob } = require('../../usecases/journey/runJourneyTodoReminderJob');

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
    writeJson(res, 503, { ok: false, error: 'JOURNEY_JOB_TOKEN not configured' });
    return false;
  }
  const actual = resolveToken(req);
  if (!actual || actual !== expected) {
    writeJson(res, 401, { ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

async function handleJourneyTodoReminderJob(req, res, bodyText) {
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireJourneyJobToken(req, res)) return;

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

  writeJson(res, 200, result);
}

module.exports = {
  handleJourneyTodoReminderJob,
  requireJourneyJobToken
};
