'use strict';

const { runPhase2Automation } = require('../../usecases/phase2/runAutomation');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.phase2.automation';

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    writeJson(res, 400, { ok: false, error: 'invalid json' }, { reason: 'invalid_json' });
    return null;
  }
}

async function handleRunPhase2(req, res, body, deps) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const fallbackMode = payload && typeof payload.fallbackMode === 'string'
    ? payload.fallbackMode.trim().toLowerCase()
    : '';
  if (fallbackMode && fallbackMode !== 'allow' && fallbackMode !== 'block') {
    writeJson(res, 400, { ok: false, error: 'invalid fallbackMode' }, { reason: 'invalid_fallback_mode' });
    return;
  }
  const runFn = deps && typeof deps.runPhase2Automation === 'function'
    ? deps.runPhase2Automation
    : runPhase2Automation;
  const logger = deps && typeof deps.logger === 'function' ? deps.logger : (msg) => console.log(msg);
  const result = await runFn({
    runId: payload.runId,
    targetDate: payload.targetDate,
    dryRun: payload.dryRun,
    analyticsLimit: payload.analyticsLimit,
    fallbackMode: fallbackMode || undefined,
    logger
  });
  if (!result.ok) {
    writeJson(res, 400, { ok: false, error: result.error }, { reason: result.error || 'phase2_automation_failure' });
    return;
  }
  writeJson(res, 200, { ok: true, summary: result.summary }, { reason: 'completed' });
}

module.exports = {
  handleRunPhase2
};
