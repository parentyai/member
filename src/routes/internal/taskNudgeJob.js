'use strict';

const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { runTaskNudgeJob } = require('../../usecases/tasks/runTaskNudgeJob');

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
  const header = req && req.headers ? req.headers['x-task-job-token'] : null;
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req && req.headers ? req.headers.authorization : null;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  return '';
}

function requireTaskJobToken(req, res) {
  const expected = process.env.TASK_JOB_TOKEN || '';
  if (!expected) {
    writeJson(res, 503, { ok: false, error: 'TASK_JOB_TOKEN not configured' });
    return false;
  }
  const actual = resolveToken(req);
  if (!actual || actual !== expected) {
    writeJson(res, 401, { ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

async function handleTaskNudgeJob(req, res, bodyText, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getKillSwitchFn = resolvedDeps.getKillSwitch || getKillSwitch;
  const runTaskNudgeJobFn = resolvedDeps.runTaskNudgeJob || runTaskNudgeJob;
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireTaskJobToken(req, res)) return;

  let killSwitch = false;
  try {
    killSwitch = await getKillSwitchFn();
  } catch (_err) {
    writeJson(res, 503, { ok: false, error: 'temporarily unavailable', reason: 'kill_switch_read_failed' });
    return;
  }
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

  const result = await runTaskNudgeJobFn({
    dryRun: payload.dryRun,
    limit: payload.limit,
    now: payload.now,
    traceId: traceIdHeader || payload.traceId || null,
    requestId: payload.requestId || null,
    actor: payload.actor || 'task_nudge_job'
  });

  let statusCode = 200;
  if (result && result.ok === false) {
    statusCode = result.status === 'blocked_by_killswitch_read_failed' ? 503 : 409;
  }
  writeJson(res, statusCode, result);
}

module.exports = {
  handleTaskNudgeJob,
  requireTaskJobToken
};
