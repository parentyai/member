'use strict';

const { emitObs } = require('../../ops/obs');

const JOB_KEYS = new Set(['refresh_ops_console', 'refresh_assist_cache']);

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

async function runOpsBatch(params, deps) {
  const payload = params || {};
  const jobKey = requireString(payload.jobKey, 'jobKey');
  if (!JOB_KEYS.has(jobKey)) throw new Error('invalid jobKey');

  const dryRun = Boolean(payload.dryRun);
  const limit = typeof payload.limit === 'number' ? payload.limit : null;
  const requestId = payload.requestId || null;

  if (!dryRun) {
    if (jobKey === 'refresh_ops_console' && deps && typeof deps.refreshOpsConsole === 'function') {
      await deps.refreshOpsConsole({ limit });
    }
    if (jobKey === 'refresh_assist_cache' && deps && typeof deps.refreshAssistCache === 'function') {
      await deps.refreshAssistCache({ limit });
    }
  }

  const response = {
    ok: true,
    jobKey,
    dryRun,
    limit,
    result: dryRun ? 'dry_run' : 'executed'
  };

  try {
    emitObs({
      action: 'ops_batch_run',
      result: response.result,
      requestId,
      meta: { jobKey, dryRun, limit: limit === null ? undefined : limit }
    });
  } catch (err) {
    // best-effort only
  }

  return response;
}

module.exports = {
  runOpsBatch,
  JOB_KEYS
};
