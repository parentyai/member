'use strict';

const cityPackRequestsRepo = require('../../repos/firestore/cityPackRequestsRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { runCityPackDraftJob } = require('../../usecases/cityPack/runCityPackDraftJob');
const { activateCityPack } = require('../../usecases/cityPack/activateCityPack');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
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

function normalizeLimit(value, fallback, max) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
}

function parseActionPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-requests\/([^/]+)\/(approve|reject|request-changes|retry-job|activate)$/);
  if (!match) return null;
  return { requestId: match[1], action: match[2] };
}

function parseDetailPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-requests\/([^/]+)$/);
  if (!match) return null;
  return match[1];
}

async function handleList(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const status = url.searchParams.get('status') || '';
  const regionKey = url.searchParams.get('regionKey') || '';
  const limit = normalizeLimit(url.searchParams.get('limit'), 50, 200);
  const items = await cityPackRequestsRepo.listRequests({ status, regionKey, limit });

  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.request.list',
    entityType: 'city_pack_request',
    entityId: 'query',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status: status || null,
      regionKey: regionKey || null,
      count: items.length
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    items: items.map((item) => ({
      requestId: item.id,
      status: item.status || null,
      regionCity: item.regionCity || null,
      regionState: item.regionState || null,
      regionKey: item.regionKey || null,
      lineUserId: item.lineUserId || null,
      requestedAt: item.requestedAt || null,
      lastJobRunId: item.lastJobRunId || null,
      traceId: item.traceId || null,
      draftCityPackIds: Array.isArray(item.draftCityPackIds) ? item.draftCityPackIds : [],
      draftSourceRefIds: Array.isArray(item.draftSourceRefIds) ? item.draftSourceRefIds : [],
      error: item.error || null
    }))
  });
}

async function handleDetail(req, res, context, requestId) {
  const request = await cityPackRequestsRepo.getRequest(requestId);
  if (!request) {
    writeJson(res, 404, { ok: false, error: 'request not found' });
    return;
  }

  const draftCityPackIds = Array.isArray(request.draftCityPackIds) ? request.draftCityPackIds : [];
  const draftCityPacks = [];
  for (const id of draftCityPackIds) {
    const pack = await cityPacksRepo.getCityPack(id);
    if (pack) {
      draftCityPacks.push({
        id: pack.id,
        name: pack.name || null,
        status: pack.status || null,
        sourceRefs: Array.isArray(pack.sourceRefs) ? pack.sourceRefs : []
      });
    }
  }

  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.request.view',
    entityType: 'city_pack_request',
    entityId: requestId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status: request.status || null,
      regionKey: request.regionKey || null
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    request: Object.assign({ requestId: request.id }, request),
    draftCityPacks
  });
}

async function handleAction(req, res, bodyText, context, requestId, action) {
  const request = await cityPackRequestsRepo.getRequest(requestId);
  if (!request) {
    writeJson(res, 404, { ok: false, error: 'request not found' });
    return;
  }

  if (action === 'approve') {
    const draftIds = Array.isArray(request.draftCityPackIds) ? request.draftCityPackIds : [];
    if (!draftIds.length) {
      writeJson(res, 409, { ok: false, error: 'draft_city_pack_required' });
      return;
    }
    await cityPackRequestsRepo.updateRequest(requestId, { status: 'approved', error: null });
    await appendAuditLog({
      actor: context.actor,
      action: 'city_pack.request.approve',
      entityType: 'city_pack_request',
      entityId: requestId,
      traceId: context.traceId,
      requestId: context.requestId,
      payloadSummary: { draftCityPackIds: draftIds }
    });
    writeJson(res, 200, { ok: true, requestId, status: 'approved', traceId: context.traceId });
    return;
  }

  if (action === 'reject') {
    await cityPackRequestsRepo.updateRequest(requestId, { status: 'rejected' });
    await appendAuditLog({
      actor: context.actor,
      action: 'city_pack.request.reject',
      entityType: 'city_pack_request',
      entityId: requestId,
      traceId: context.traceId,
      requestId: context.requestId,
      payloadSummary: { status: 'rejected' }
    });
    writeJson(res, 200, { ok: true, requestId, status: 'rejected', traceId: context.traceId });
    return;
  }

  if (action === 'request-changes') {
    const payload = parseJson(bodyText, res);
    if (!payload) return;
    const note = typeof payload.note === 'string' && payload.note.trim() ? payload.note.trim() : 'needs_review';
    await cityPackRequestsRepo.updateRequest(requestId, { status: 'needs_review', error: note });
    await appendAuditLog({
      actor: context.actor,
      action: 'city_pack.request.request_changes',
      entityType: 'city_pack_request',
      entityId: requestId,
      traceId: context.traceId,
      requestId: context.requestId,
      payloadSummary: { note }
    });
    writeJson(res, 200, { ok: true, requestId, status: 'needs_review', traceId: context.traceId });
    return;
  }

  if (action === 'retry-job') {
    const payload = parseJson(bodyText, res);
    if (!payload) return;
    const result = await runCityPackDraftJob({
      requestId,
      traceId: context.traceId,
      actor: context.actor,
      sourceUrls: Array.isArray(payload.sourceUrls) ? payload.sourceUrls : []
    });
    await appendAuditLog({
      actor: context.actor,
      action: 'city_pack.request.retry',
      entityType: 'city_pack_request',
      entityId: requestId,
      traceId: context.traceId,
      requestId: context.requestId,
      payloadSummary: { ok: result.ok, reason: result.reason || null }
    });
    writeJson(res, 200, Object.assign({ traceId: context.traceId }, result));
    return;
  }

  if (action === 'activate') {
    if (String(request.status) !== 'approved') {
      writeJson(res, 409, { ok: false, error: 'request_not_approved' });
      return;
    }
    const draftIds = Array.isArray(request.draftCityPackIds) ? request.draftCityPackIds : [];
    if (!draftIds.length) {
      writeJson(res, 409, { ok: false, error: 'draft_city_pack_required' });
      return;
    }
    const results = [];
    for (const cityPackId of draftIds) {
      const result = await activateCityPack({
        cityPackId,
        actor: context.actor,
        traceId: context.traceId,
        requestId: context.requestId
      });
      results.push(result);
    }
    const failed = results.filter((item) => !item || item.ok === false);
    if (failed.length) {
      writeJson(res, 409, { ok: false, error: 'activation_failed', results, traceId: context.traceId });
      return;
    }
    await cityPackRequestsRepo.updateRequest(requestId, { status: 'active' });
    await appendAuditLog({
      actor: context.actor,
      action: 'city_pack.request.activate',
      entityType: 'city_pack_request',
      entityId: requestId,
      traceId: context.traceId,
      requestId: context.requestId,
      payloadSummary: { activated: draftIds }
    });
    writeJson(res, 200, { ok: true, requestId, status: 'active', results, traceId: context.traceId });
    return;
  }

  writeJson(res, 404, { ok: false, error: 'not found' });
}

async function handleCityPackRequests(req, res, bodyText) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };

  try {
    if (req.method === 'GET' && pathname === '/api/admin/city-pack-requests') {
      await handleList(req, res, context);
      return;
    }
    if (req.method === 'GET') {
      const requestId = parseDetailPath(pathname);
      if (requestId) {
        await handleDetail(req, res, context, requestId);
        return;
      }
    }
    if (req.method === 'POST') {
      const parsed = parseActionPath(pathname);
      if (parsed) {
        await handleAction(req, res, bodyText, context, parsed.requestId, parsed.action);
        return;
      }
    }

    writeJson(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    logRouteError('admin.city_pack_requests', err, context);
    writeJson(res, 500, { ok: false, error: err && err.message ? err.message : 'error' });
  }
}

module.exports = {
  handleCityPackRequests
};
