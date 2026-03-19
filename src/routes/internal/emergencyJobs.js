'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { runEmergencySync } = require('../../usecases/emergency/runEmergencySync');
const { fetchProviderSnapshot } = require('../../usecases/emergency/fetchProviderSnapshot');
const { normalizeAndDiffProvider } = require('../../usecases/emergency/normalizeAndDiffProvider');
const { summarizeDraftWithLLM } = require('../../usecases/emergency/summarizeDraftWithLLM');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

function resolveRouteKey(pathname) {
  if (pathname === '/internal/jobs/emergency-sync') return 'internal_emergency_sync_job';
  if (pathname === '/internal/jobs/emergency-provider-fetch') return 'internal_emergency_provider_fetch_job';
  if (pathname === '/internal/jobs/emergency-provider-normalize') return 'internal_emergency_provider_normalize_job';
  if (pathname === '/internal/jobs/emergency-provider-summarize') return 'internal_emergency_provider_summarize_job';
  return 'internal_emergency_jobs';
}

function writeJson(res, status, payload, routeKey, outcomeOptions) {
  const body = attachOutcome(payload || {}, Object.assign({
    routeType: 'internal_job',
    guard: { routeKey }
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

function resolveInternalJobStatusCode(result) {
  const row = result && typeof result === 'object' ? result : null;
  if (!row || row.ok !== false) return 200;
  if (row.blocked === true || row.reason === 'kill_switch_on') return 409;
  if (row.partial === true || row.partialFailure === true) return 207;
  if (Number.isInteger(row.httpStatus) && row.httpStatus >= 400 && row.httpStatus <= 599) return row.httpStatus;
  if (Number.isInteger(row.statusCode) && row.statusCode >= 400 && row.statusCode <= 599) return row.statusCode;
  return 500;
}

function resolveOutcome(result) {
  const row = result && typeof result === 'object' ? result : {};
  if (row.ok === false && (row.blocked === true || row.reason === 'kill_switch_on')) {
    return { state: 'blocked', reason: typeof row.reason === 'string' && row.reason.trim() ? row.reason.trim() : 'blocked' };
  }
  if (row.ok === false && (row.partial === true || row.partialFailure === true)) {
    return { state: 'partial', reason: typeof row.reason === 'string' && row.reason.trim() ? row.reason.trim() : 'completed_with_failures' };
  }
  if (row.ok === false) {
    return { state: 'error', reason: typeof row.reason === 'string' && row.reason.trim() ? row.reason.trim() : 'emergency_job_failed' };
  }
  return { state: 'success', reason: 'completed' };
}

async function handleEmergencyJobs(req, res, bodyText, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getKillSwitchFn = resolvedDeps.getKillSwitch || getKillSwitch;
  const runEmergencySyncFn = resolvedDeps.runEmergencySync || runEmergencySync;
  const fetchProviderSnapshotFn = resolvedDeps.fetchProviderSnapshot || fetchProviderSnapshot;
  const normalizeAndDiffProviderFn = resolvedDeps.normalizeAndDiffProvider || normalizeAndDiffProvider;
  const summarizeDraftWithLLMFn = resolvedDeps.summarizeDraftWithLLM || summarizeDraftWithLLM;
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const routeKey = resolveRouteKey(pathname);
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' }, routeKey, {
      state: 'error',
      reason: 'not_found',
      guard: { routeKey, decision: 'block' }
    });
    return;
  }
  if (!requireInternalJobToken(req, res, {
    routeType: 'internal_job',
    guard: { routeKey }
  })) return;

  const killSwitchOn = await getKillSwitchFn();
  if (killSwitchOn) {
    writeJson(res, 409, { ok: false, error: 'kill switch on' }, routeKey, {
      state: 'blocked',
      reason: 'kill_switch_on',
      guard: { routeKey, decision: 'block', killSwitchOn: true }
    });
    return;
  }

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' }, routeKey, {
      state: 'error',
      reason: 'invalid_json',
      guard: { routeKey, decision: 'block' }
    });
    return;
  }
  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : null;
  const traceId = traceIdHeader || payload.traceId || null;

  if (pathname === '/internal/jobs/emergency-sync') {
    const result = await runEmergencySyncFn({
      runId: payload.runId,
      traceId,
      actor: 'emergency_sync_job',
      providerKeys: payload.providerKeys,
      providerKey: payload.providerKey,
      forceProviderKeys: payload.forceProviderKeys,
      forceRefresh: payload.forceRefresh === true,
      skipSummarize: payload.skipSummarize === true,
      dryRun: payload.dryRun === true,
      maxRecipientsPerRun: payload.maxRecipientsPerRun
    });
    const outcome = resolveOutcome(result);
    writeJson(res, resolveInternalJobStatusCode(result), result, routeKey, Object.assign(outcome, {
      guard: { routeKey, decision: outcome.state === 'blocked' || outcome.state === 'error' ? 'block' : 'allow' }
    }));
    return;
  }

  if (pathname === '/internal/jobs/emergency-provider-fetch') {
    const result = await fetchProviderSnapshotFn({
      providerKey: payload.providerKey,
      runId: payload.runId,
      traceId,
      actor: 'emergency_provider_fetch_job',
      forceRefresh: payload.forceRefresh === true
    });
    const outcome = resolveOutcome(result);
    writeJson(res, resolveInternalJobStatusCode(result), result, routeKey, Object.assign(outcome, {
      guard: { routeKey, decision: outcome.state === 'blocked' || outcome.state === 'error' ? 'block' : 'allow' }
    }));
    return;
  }

  if (pathname === '/internal/jobs/emergency-provider-normalize') {
    const result = await normalizeAndDiffProviderFn({
      providerKey: payload.providerKey,
      snapshotId: payload.snapshotId,
      payloadJson: payload.payloadJson || null,
      payloadText: payload.payloadText || null,
      runId: payload.runId,
      traceId,
      actor: 'emergency_provider_normalize_job'
    });
    const outcome = resolveOutcome(result);
    writeJson(res, resolveInternalJobStatusCode(result), result, routeKey, Object.assign(outcome, {
      guard: { routeKey, decision: outcome.state === 'blocked' || outcome.state === 'error' ? 'block' : 'allow' }
    }));
    return;
  }

  if (pathname === '/internal/jobs/emergency-provider-summarize') {
    const result = await summarizeDraftWithLLMFn({
      diffId: payload.diffId,
      runId: payload.runId,
      traceId,
      actor: 'emergency_provider_summarize_job'
    });
    const outcome = resolveOutcome(result);
    writeJson(res, resolveInternalJobStatusCode(result), result, routeKey, Object.assign(outcome, {
      guard: { routeKey, decision: outcome.state === 'blocked' || outcome.state === 'error' ? 'block' : 'allow' }
    }));
    return;
  }

  writeJson(res, 404, { ok: false, error: 'not found' }, routeKey, {
    state: 'error',
    reason: 'not_found',
    guard: { routeKey, decision: 'block' }
  });
}

module.exports = {
  handleEmergencyJobs
};
