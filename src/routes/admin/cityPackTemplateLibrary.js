'use strict';

const cityPackTemplateLibraryRepo = require('../../repos/firestore/cityPackTemplateLibraryRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { resolveActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const LIST_ROUTE_KEY = 'admin.city_pack_template_library_list';
const DETAIL_ROUTE_KEY = 'admin.city_pack_template_library_detail';
const CREATE_ROUTE_KEY = 'admin.city_pack_template_library_create';
const ACTION_ROUTE_KEY = 'admin.city_pack_template_library_action';

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, routeKey, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
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

async function handleList(req, res, context, deps) {
  const url = new URL(req.url, 'http://localhost');
  const status = (url.searchParams.get('status') || '').trim() || null;
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const listTemplates = typeof resolvedDeps.listTemplates === 'function'
    ? resolvedDeps.listTemplates
    : cityPackTemplateLibraryRepo.listTemplates;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const items = await listTemplates({ status, limit });
  await appendAudit({
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
  writeJson(res, LIST_ROUTE_KEY, 200, {
    ok: true,
    traceId: context.traceId,
    items
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleDetail(req, res, context, templateId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getTemplate = typeof resolvedDeps.getTemplate === 'function'
    ? resolvedDeps.getTemplate
    : cityPackTemplateLibraryRepo.getTemplate;
  const item = await getTemplate(templateId);
  if (!item) {
    writeJson(res, DETAIL_ROUTE_KEY, 404, { ok: false, error: 'template not found' }, {
      state: 'error',
      reason: 'template_not_found'
    });
    return;
  }
  writeJson(res, DETAIL_ROUTE_KEY, 200, {
    ok: true,
    traceId: context.traceId,
    item
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleCreate(req, res, bodyText, context, deps) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const createTemplate = typeof resolvedDeps.createTemplate === 'function'
    ? resolvedDeps.createTemplate
    : cityPackTemplateLibraryRepo.createTemplate;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const created = await createTemplate({
    name: payload.name,
    template: payload.template,
    status: payload.status,
    source: payload.source || 'manual',
    traceId: context.traceId,
    requestId: payload.requestId
  });
  await appendAudit({
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
  writeJson(res, CREATE_ROUTE_KEY, 201, {
    ok: true,
    templateId: created.id,
    traceId: context.traceId
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleAction(req, res, context, templateId, action, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getTemplate = typeof resolvedDeps.getTemplate === 'function'
    ? resolvedDeps.getTemplate
    : cityPackTemplateLibraryRepo.getTemplate;
  const updateTemplate = typeof resolvedDeps.updateTemplate === 'function'
    ? resolvedDeps.updateTemplate
    : cityPackTemplateLibraryRepo.updateTemplate;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const current = await getTemplate(templateId);
  if (!current) {
    writeJson(res, ACTION_ROUTE_KEY, 404, { ok: false, error: 'template not found' }, {
      state: 'error',
      reason: 'template_not_found'
    });
    return;
  }
  const patch = action === 'activate'
    ? { status: 'active', activatedAt: new Date().toISOString() }
    : { status: 'retired', retiredAt: new Date().toISOString() };
  await updateTemplate(templateId, patch);
  await appendAudit({
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
  writeJson(res, ACTION_ROUTE_KEY, 200, {
    ok: true,
    templateId,
    status: patch.status,
    traceId: context.traceId
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleCityPackTemplateLibrary(req, res, bodyText, deps) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };
  let routeKey = LIST_ROUTE_KEY;

  try {
    if (req.method === 'GET' && pathname === '/api/admin/city-pack-template-library') {
      routeKey = LIST_ROUTE_KEY;
      await handleList(req, res, context, deps);
      return;
    }
    if (req.method === 'GET') {
      const templateId = parseDetail(pathname);
      if (templateId) {
        routeKey = DETAIL_ROUTE_KEY;
        await handleDetail(req, res, context, templateId, deps);
        return;
      }
    }
    if (req.method === 'POST' && pathname === '/api/admin/city-pack-template-library') {
      routeKey = CREATE_ROUTE_KEY;
      await handleCreate(req, res, bodyText, context, deps);
      return;
    }
    if (req.method === 'POST') {
      const parsed = parseAction(pathname);
      if (parsed) {
        routeKey = ACTION_ROUTE_KEY;
        await handleAction(req, res, context, parsed.templateId, parsed.action, deps);
        return;
      }
    }
    writeJson(res, routeKey, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found'
    });
  } catch (err) {
    logRouteError('admin.city_pack_template_library', err, context);
    writeJson(res, routeKey, 500, { ok: false, error: err && err.message ? err.message : 'error' }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleCityPackTemplateLibrary
};
