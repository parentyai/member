'use strict';

const cityPackTemplateLibraryRepo = require('../../repos/firestore/cityPackTemplateLibraryRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
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

function parseAction(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-template-library\/([^/]+)\/(activate|retire)$/);
  if (!match) return null;
  return {
    templateId: decodeURIComponent(match[1]),
    action: match[2]
  };
}

function parseDetail(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-template-library\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

async function handleList(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const status = (url.searchParams.get('status') || '').trim() || null;
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const items = await cityPackTemplateLibraryRepo.listTemplates({ status, limit });
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.template_library.view',
    entityType: 'city_pack_template_library',
    entityId: 'list',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status,
      count: items.length
    }
  });
  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    items
  });
}

async function handleDetail(req, res, context, templateId) {
  const item = await cityPackTemplateLibraryRepo.getTemplate(templateId);
  if (!item) {
    writeJson(res, 404, { ok: false, error: 'template not found' });
    return;
  }
  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    item
  });
}

async function handleCreate(req, res, bodyText, context) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const created = await cityPackTemplateLibraryRepo.createTemplate({
    name: payload.name,
    template: payload.template,
    status: payload.status,
    source: payload.source || 'manual',
    traceId: context.traceId,
    requestId: payload.requestId
  });
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.template_library.create',
    entityType: 'city_pack_template_library',
    entityId: created.id,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      name: payload.name || null
    }
  });
  writeJson(res, 201, {
    ok: true,
    templateId: created.id,
    traceId: context.traceId
  });
}

async function handleAction(req, res, context, templateId, action) {
  const current = await cityPackTemplateLibraryRepo.getTemplate(templateId);
  if (!current) {
    writeJson(res, 404, { ok: false, error: 'template not found' });
    return;
  }
  const patch = action === 'activate'
    ? { status: 'active', activatedAt: new Date().toISOString() }
    : { status: 'retired', retiredAt: new Date().toISOString() };
  await cityPackTemplateLibraryRepo.updateTemplate(templateId, patch);
  await appendAuditLog({
    actor: context.actor,
    action: `city_pack.template_library.${action}`,
    entityType: 'city_pack_template_library',
    entityId: templateId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status: patch.status
    }
  });
  writeJson(res, 200, {
    ok: true,
    templateId,
    status: patch.status,
    traceId: context.traceId
  });
}

async function handleCityPackTemplateLibrary(req, res, bodyText) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };

  try {
    if (req.method === 'GET' && pathname === '/api/admin/city-pack-template-library') {
      await handleList(req, res, context);
      return;
    }
    if (req.method === 'GET') {
      const templateId = parseDetail(pathname);
      if (templateId) {
        await handleDetail(req, res, context, templateId);
        return;
      }
    }
    if (req.method === 'POST' && pathname === '/api/admin/city-pack-template-library') {
      await handleCreate(req, res, bodyText, context);
      return;
    }
    if (req.method === 'POST') {
      const parsed = parseAction(pathname);
      if (parsed) {
        await handleAction(req, res, context, parsed.templateId, parsed.action);
        return;
      }
    }
    writeJson(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    logRouteError('admin.city_pack_template_library', err, context);
    writeJson(res, 500, { ok: false, error: err && err.message ? err.message : 'error' });
  }
}

module.exports = {
  handleCityPackTemplateLibrary
};
