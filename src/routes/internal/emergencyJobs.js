'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { runEmergencySync } = require('../../usecases/emergency/runEmergencySync');
const { fetchProviderSnapshot } = require('../../usecases/emergency/fetchProviderSnapshot');
const { normalizeAndDiffProvider } = require('../../usecases/emergency/normalizeAndDiffProvider');
const { summarizeDraftWithLLM } = require('../../usecases/emergency/summarizeDraftWithLLM');

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

async function handleEmergencyJobs(req, res, bodyText) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireInternalJobToken(req, res)) return;

  const killSwitchOn = await getKillSwitch();
  if (killSwitchOn) {
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
  const traceId = traceIdHeader || payload.traceId || null;

  if (pathname === '/internal/jobs/emergency-sync') {
    const result = await runEmergencySync({
      runId: payload.runId,
      traceId,
      actor: 'emergency_sync_job',
      providerKeys: payload.providerKeys,
      providerKey: payload.providerKey,
      forceProviderKeys: payload.forceProviderKeys,
      forceRefresh: payload.forceRefresh === true,
      skipSummarize: payload.skipSummarize === true
    });
    writeJson(res, 200, result);
    return;
  }

  if (pathname === '/internal/jobs/emergency-provider-fetch') {
    const result = await fetchProviderSnapshot({
      providerKey: payload.providerKey,
      runId: payload.runId,
      traceId,
      actor: 'emergency_provider_fetch_job',
      forceRefresh: payload.forceRefresh === true
    });
    writeJson(res, 200, result);
    return;
  }

  if (pathname === '/internal/jobs/emergency-provider-normalize') {
    const result = await normalizeAndDiffProvider({
      providerKey: payload.providerKey,
      snapshotId: payload.snapshotId,
      payloadJson: payload.payloadJson || null,
      payloadText: payload.payloadText || null,
      runId: payload.runId,
      traceId,
      actor: 'emergency_provider_normalize_job'
    });
    writeJson(res, 200, result);
    return;
  }

  if (pathname === '/internal/jobs/emergency-provider-summarize') {
    const result = await summarizeDraftWithLLM({
      diffId: payload.diffId,
      runId: payload.runId,
      traceId,
      actor: 'emergency_provider_summarize_job'
    });
    writeJson(res, 200, result);
    return;
  }

  writeJson(res, 404, { ok: false, error: 'not found' });
}

module.exports = {
  handleEmergencyJobs
};
