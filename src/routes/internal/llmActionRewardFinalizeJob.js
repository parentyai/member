'use strict';

const { enforceLlmGenerationKillSwitch } = require('../admin/osContext');
const { finalizeLlmActionRewards } = require('../../usecases/assistant/learning/finalizeLlmActionRewards');
const { appendLlmGateDecision } = require('../../usecases/llm/appendLlmGateDecision');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_KEY = 'internal_llm_action_reward_finalize_job';
const ENTRY_TYPE = 'job';
const GATES_APPLIED = ['kill_switch', 'snapshot'];

function writeJson(res, status, payload, outcomeOptions) {
  const body = outcomeOptions && typeof outcomeOptions === 'object'
    ? attachOutcome(payload || {}, outcomeOptions)
    : payload;
  if (body && body.outcome) applyOutcomeHeaders(res, body.outcome);
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
    writeJson(res, 503, { ok: false, error: 'LLM_ACTION_JOB_TOKEN not configured' }, { state: 'error', reason: 'job_token_not_configured' });
    return false;
  }
  const actual = resolveToken(req);
  if (!actual || actual !== expected) {
    writeJson(res, 401, { ok: false, error: 'unauthorized' }, { state: 'blocked', reason: 'unauthorized' });
    return false;
  }
  return true;
}

function resolveOutcome(result) {
  const row = result && typeof result === 'object' ? result : {};
  if (row.dryRun === true && Number(row.errors) === 0) return { state: 'success', reason: 'dry_run' };
  if (Number(row.errors) > 0 && Number(row.updated) > 0) return { state: 'partial', reason: 'completed_with_errors' };
  if (Number(row.errors) > 0) return { state: 'error', reason: 'completed_with_errors' };
  if (Number(row.processed) === 0 || Number(row.skipped) === Number(row.processed)) return { state: 'success', reason: 'no_eligible_rows' };
  return { state: 'success', reason: 'completed' };
}

async function handleLlmActionRewardFinalizeJob(req, res, bodyText, deps) {
  const enforceKillSwitchFn = deps && typeof deps.enforceLlmGenerationKillSwitchFn === 'function'
    ? deps.enforceLlmGenerationKillSwitchFn
    : enforceLlmGenerationKillSwitch;
  const finalizeLlmActionRewardsFn = deps && typeof deps.finalizeLlmActionRewardsFn === 'function'
    ? deps.finalizeLlmActionRewardsFn
    : finalizeLlmActionRewards;
  const appendLlmGateDecisionFn = deps && typeof deps.appendLlmGateDecisionFn === 'function'
    ? deps.appendLlmGateDecisionFn
    : appendLlmGateDecision;
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
  const allowed = await enforceKillSwitchFn(req, res, {
    routeKey: ROUTE_KEY,
    actor,
    traceId: traceIdHeader || null,
    requestId: requestIdHeader || null,
    onDecision: (decision) => {
      killSwitchDecision = decision;
      }
  });
  if (!allowed) {
    await appendLlmGateDecisionFn({
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
    writeJson(res, 400, { ok: false, error: 'invalid json' }, { state: 'error', reason: 'invalid_json' });
    return;
  }
  const traceId = traceIdHeader || payload.traceId || null;
  const requestId = requestIdHeader || payload.requestId || null;

  const result = await finalizeLlmActionRewardsFn({
    dryRun: payload.dryRun,
    limit: payload.limit,
    rewardWindowHours: payload.rewardWindowHours,
    traceId,
    requestId,
    now: payload.now,
    actor
  });

  await appendLlmGateDecisionFn({
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

  writeJson(res, 200, result, resolveOutcome(result));
}

module.exports = {
  handleLlmActionRewardFinalizeJob,
  requireLlmActionJobToken
};
