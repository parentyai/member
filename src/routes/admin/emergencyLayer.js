'use strict';

const emergencyProvidersRepo = require('../../repos/firestore/emergencyProvidersRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  listEmergencyProviders,
  updateEmergencyProvider,
  listEmergencyBulletins,
  getEmergencyBulletin,
  rejectEmergencyBulletin,
  getEmergencyEvidence
} = require('../../usecases/emergency/adminEmergencyLayer');
const { fetchProviderSnapshot } = require('../../usecases/emergency/fetchProviderSnapshot');
const { normalizeAndDiffProvider } = require('../../usecases/emergency/normalizeAndDiffProvider');
const { summarizeDraftWithLLM } = require('../../usecases/emergency/summarizeDraftWithLLM');
const { approveEmergencyBulletin } = require('../../usecases/emergency/approveEmergencyBulletin');
const {
  resolveActor,
  resolveRequestId,
  resolveTraceId,
  parseJson,
  logRouteError
} = require('./osContext');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseProviderPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/providers\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]).trim().toLowerCase();
}

function parseProviderForcePath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/providers\/([^/]+)\/force-refresh$/);
  if (!match) return null;
  return decodeURIComponent(match[1]).trim().toLowerCase();
}

function parseBulletinPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/bulletins\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]).trim();
}

function parseBulletinActionPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/bulletins\/([^/]+)\/(approve|reject)$/);
  if (!match) return null;
  return {
    bulletinId: decodeURIComponent(match[1]).trim(),
    action: match[2]
  };
}

function parseEvidencePath(pathname) {
  const match = pathname.match(/^\/api\/admin\/emergency\/evidence\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]).trim();
}

async function handleListProviders(req, res, context) {
  const result = await listEmergencyProviders({
    traceId: context.traceId
  });
  writeJson(res, 200, result);
}

async function handleUpdateProvider(req, res, bodyText, context, providerKey) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const result = await updateEmergencyProvider({
    providerKey,
    status: payload.status,
    scheduleMinutes: payload.scheduleMinutes,
    officialLinkRegistryId: payload.officialLinkRegistryId,
    actor: context.actor,
    requestId: context.requestId,
    traceId: context.traceId
  });
  writeJson(res, 200, result);
}

async function handleForceRefreshProvider(req, res, bodyText, context, providerKey) {
  const payload = bodyText ? parseJson(bodyText, res) : {};
  if (bodyText && !payload) return;
  const provider = await emergencyProvidersRepo.getProvider(providerKey);
  if (!provider) {
    writeJson(res, 404, { ok: false, error: 'provider not found' });
    return;
  }
  if (provider.status !== 'enabled') {
    writeJson(res, 409, { ok: false, error: 'provider_disabled' });
    return;
  }
  const runId = `emg_force_${providerKey}_${Date.now()}`;
  const fetchResult = await fetchProviderSnapshot({
    providerKey,
    traceId: context.traceId,
    runId,
    actor: context.actor,
    forceRefresh: true
  });
  let normalizeResult = null;
  const summarizeResults = [];
  if (fetchResult && fetchResult.ok && fetchResult.changed !== false && Number(fetchResult.statusCode) !== 304) {
    normalizeResult = await normalizeAndDiffProvider({
      providerKey,
      snapshotId: fetchResult.snapshotId || null,
      payloadJson: fetchResult.payloadJson || null,
      payloadText: fetchResult.payloadText || null,
      traceId: context.traceId,
      runId,
      actor: context.actor
    });
    if (payload && payload.summarize === true && Array.isArray(normalizeResult.diffIds)) {
      for (const diffId of normalizeResult.diffIds) {
        const summary = await summarizeDraftWithLLM({
          diffId,
          traceId: context.traceId,
          runId: `${runId}__sum`,
          actor: context.actor
        });
        summarizeResults.push(summary);
      }
    }
  }
  await appendAuditLog({
    actor: context.actor,
    action: 'emergency.provider.force_refresh',
    entityType: 'emergency_provider',
    entityId: providerKey,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      fetchOk: Boolean(fetchResult && fetchResult.ok),
      snapshotId: fetchResult && fetchResult.snapshotId ? fetchResult.snapshotId : null
    }
  });
  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    providerKey,
    fetchResult,
    normalizeResult,
    summarizeResults
  });
}

async function handleListBulletins(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const result = await listEmergencyBulletins({
    status: url.searchParams.get('status'),
    regionKey: url.searchParams.get('regionKey'),
    limit: url.searchParams.get('limit'),
    traceId: context.traceId
  });
  writeJson(res, 200, result);
}

async function handleGetBulletin(req, res, context, bulletinId) {
  const result = await getEmergencyBulletin({
    bulletinId,
    traceId: context.traceId
  });
  writeJson(res, 200, result);
}

async function handleRejectBulletin(req, res, context, bulletinId) {
  const result = await rejectEmergencyBulletin({
    bulletinId,
    actor: context.actor,
    requestId: context.requestId,
    traceId: context.traceId
  });
  writeJson(res, 200, result);
}

function resolveStatusCodeFromApproveResult(result) {
  if (!result || result.ok === true) return 200;
  if (result.blocked) return 409;
  if (result.reason === 'GUARD_BLOCK_WARN_LINK') return 409;
  if (result.reason === 'MISSING_LINK_REGISTRY_ID') return 409;
  if (result.reason === 'INVALID_CTA') return 409;
  return 400;
}

async function handleApproveBulletin(req, res, bodyText, context, bulletinId) {
  const payload = bodyText ? parseJson(bodyText, res) : {};
  if (bodyText && !payload) return;
  const result = await approveEmergencyBulletin({
    bulletinId,
    ctaText: payload && payload.ctaText ? payload.ctaText : null,
    actor: context.actor,
    traceId: context.traceId,
    requestId: context.requestId
  });
  writeJson(res, resolveStatusCodeFromApproveResult(result), Object.assign({ traceId: context.traceId }, result));
}

async function handleGetEvidence(req, res, context, bulletinId) {
  const url = new URL(req.url, 'http://localhost');
  const result = await getEmergencyEvidence({
    bulletinId,
    unmappedLimit: url.searchParams.get('unmappedLimit'),
    traceId: context.traceId
  });
  writeJson(res, 200, result);
}

async function handleEmergencyLayer(req, res, bodyText) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };
  try {
    if (req.method === 'GET' && pathname === '/api/admin/emergency/providers') {
      await handleListProviders(req, res, context);
      return;
    }
    if (req.method === 'POST') {
      const providerKey = parseProviderPath(pathname);
      if (providerKey) {
        await handleUpdateProvider(req, res, bodyText, context, providerKey);
        return;
      }
      const forceProviderKey = parseProviderForcePath(pathname);
      if (forceProviderKey) {
        await handleForceRefreshProvider(req, res, bodyText, context, forceProviderKey);
        return;
      }
    }
    if (req.method === 'GET' && pathname === '/api/admin/emergency/bulletins') {
      await handleListBulletins(req, res, context);
      return;
    }
    if (req.method === 'GET') {
      const bulletinId = parseBulletinPath(pathname);
      if (bulletinId) {
        await handleGetBulletin(req, res, context, bulletinId);
        return;
      }
      const evidenceBulletinId = parseEvidencePath(pathname);
      if (evidenceBulletinId) {
        await handleGetEvidence(req, res, context, evidenceBulletinId);
        return;
      }
    }
    if (req.method === 'POST') {
      const action = parseBulletinActionPath(pathname);
      if (action && action.action === 'approve') {
        await handleApproveBulletin(req, res, bodyText, context, action.bulletinId);
        return;
      }
      if (action && action.action === 'reject') {
        await handleRejectBulletin(req, res, context, action.bulletinId);
        return;
      }
    }
    writeJson(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    logRouteError('admin.emergency_layer', err, context);
    if (err && Number.isInteger(err.statusCode)) {
      writeJson(res, err.statusCode, { ok: false, error: err.message || 'error' });
      return;
    }
    writeJson(res, 500, { ok: false, error: 'error' });
  }
}

module.exports = {
  handleEmergencyLayer
};
