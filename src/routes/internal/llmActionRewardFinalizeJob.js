'use strict';

const { enforceLlmGenerationKillSwitch } = require('../admin/osContext');
const { finalizeLlmActionRewards } = require('../../usecases/assistant/learning/finalizeLlmActionRewards');
const { appendLlmGateDecision } = require('../../usecases/llm/appendLlmGateDecision');

const ROUTE_KEY = 'internal_llm_action_reward_finalize_job';
const ENTRY_TYPE = 'job';
const GATES_APPLIED = ['kill_switch', 'snapshot'];

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
  const header = req && req.headers ? req.headers['x-llm-action-job-token'] : null;
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req && req.headers ? req.headers.authorization : null;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  return '';
}

function requireLlmActionJobToken(req, res) {
  const expected = process.env.LLM_ACTION_JOB_TOKEN || '';
  if (!expected) {
    writeJson(res, 503, { ok: false, error: 'LLM_ACTION_JOB_TOKEN not configured' });
    return false;
  }
  const actual = resolveToken(req);
  if (!actual || actual !== expected) {
    writeJson(res, 401, { ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

async function handleLlmActionRewardFinalizeJob(req, res, bodyText) {
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireLlmActionJobToken(req, res)) return;

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : null;
  const requestIdHeader = req.headers && typeof req.headers['x-request-id'] === 'string'
    ? req.headers['x-request-id'].trim()
    : null;
  const actor = 'llm_action_reward_job';

  let killSwitchDecision = null;
  const allowed = await enforceLlmGenerationKillSwitch(req, res, {
    routeKey: ROUTE_KEY,
    actor,
    traceId: traceIdHeader || null,
    requestId: requestIdHeader || null,
    onDecision: (decision) => {
      killSwitchDecision = decision;
    }
  });
  if (!allowed) {
    await appendLlmGateDecision({
      actor,
      traceId: traceIdHeader || null,
      requestId: requestIdHeader || null,
      plan: 'system',
      status: 'blocked',
      intent: 'reward_finalize',
      decision: 'blocked',
      blockedReason: killSwitchDecision && typeof killSwitchDecision.reason === 'string'
        ? killSwitchDecision.reason
        : 'kill_switch_blocked',
      entryType: ENTRY_TYPE,
      gatesApplied: GATES_APPLIED
    }).catch(() => null);
    return;
  }

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' });
    return;
  }
  const traceId = traceIdHeader || payload.traceId || null;
  const requestId = requestIdHeader || payload.requestId || null;

  const result = await finalizeLlmActionRewards({
    dryRun: payload.dryRun,
    limit: payload.limit,
    rewardWindowHours: payload.rewardWindowHours,
    traceId,
    requestId,
    now: payload.now,
    actor
  });

  await appendLlmGateDecision({
    actor,
    traceId,
    requestId,
    plan: 'system',
    status: result && result.ok === true ? 'ok' : 'error',
    intent: 'reward_finalize',
    decision: result && result.ok === true ? 'allow' : 'blocked',
    blockedReason: result && result.ok === true ? null : 'reward_finalize_error',
    entryType: ENTRY_TYPE,
    gatesApplied: GATES_APPLIED
  }).catch(() => null);

  writeJson(res, 200, result);
}

module.exports = {
  handleLlmActionRewardFinalizeJob,
  requireLlmActionJobToken
};
