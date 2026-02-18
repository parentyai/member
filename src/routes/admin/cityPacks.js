'use strict';

const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { activateCityPack } = require('../../usecases/cityPack/activateCityPack');
const { resolveActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 50;
  return Math.min(Math.floor(num), 200);
}

function parseCityPackId(pathname) {
  const activateMatch = pathname.match(/^\/api\/admin\/city-packs\/([^/]+)\/(activate|retire)$/);
  if (!activateMatch) return null;
  return {
    cityPackId: decodeURIComponent(activateMatch[1]),
    action: activateMatch[2]
  };
}

async function handleCreateCityPack(req, res, bodyText, context) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const created = await cityPacksRepo.createCityPack({
    id: payload.id,
    name: payload.name,
    description: payload.description,
    sourceRefs: payload.sourceRefs,
    validUntil: payload.validUntil,
    allowedIntents: payload.allowedIntents,
    status: payload.status,
    rules: payload.rules,
    metadata: payload.metadata
  });
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.create',
    entityType: 'city_pack',
    entityId: created.id,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      name: payload.name || null,
      sourceRefCount: Array.isArray(payload.sourceRefs) ? payload.sourceRefs.length : 0,
      validUntil: payload.validUntil || null
    }
  });
  writeJson(res, 201, {
    ok: true,
    cityPackId: created.id,
    traceId: context.traceId
  });
}

async function handleListCityPacks(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const status = (url.searchParams.get('status') || '').trim() || null;
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const items = await cityPacksRepo.listCityPacks({ status, limit });
  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    items
  });
}

async function handleActivateCityPack(req, res, context, cityPackId) {
  const result = await activateCityPack({
    cityPackId,
    actor: context.actor,
    traceId: context.traceId,
    requestId: context.requestId
  });
  if (!result.ok) {
    writeJson(res, 409, result);
    return;
  }
  writeJson(res, 200, result);
}

async function handleRetireCityPack(req, res, context, cityPackId) {
  await cityPacksRepo.updateCityPack(cityPackId, { status: 'retired' });
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.retire',
    entityType: 'city_pack',
    entityId: cityPackId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status: 'retired'
    }
  });
  writeJson(res, 200, {
    ok: true,
    cityPackId,
    status: 'retired',
    traceId: context.traceId
  });
}

async function handleCityPacks(req, res, bodyText) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };

  try {
    if (req.method === 'GET' && pathname === '/api/admin/city-packs') {
      await handleListCityPacks(req, res, context);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/city-packs') {
      await handleCreateCityPack(req, res, bodyText, context);
      return;
    }

    if (req.method === 'POST') {
      const parsed = parseCityPackId(pathname);
      if (parsed && parsed.action === 'activate') {
        await handleActivateCityPack(req, res, context, parsed.cityPackId);
        return;
      }
      if (parsed && parsed.action === 'retire') {
        await handleRetireCityPack(req, res, context, parsed.cityPackId);
        return;
      }
    }

    writeJson(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    logRouteError('admin.city_packs', err, context);
    const message = err && err.message ? err.message : 'error';
    writeJson(res, 500, { ok: false, error: message });
  }
}

module.exports = {
  handleCityPacks
};
