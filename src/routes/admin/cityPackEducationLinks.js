'use strict';

const schoolCalendarLinksRepo = require('../../repos/firestore/schoolCalendarLinksRepo');
const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { resolveActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const LIST_ROUTE_KEY = 'admin.city_pack_education_links_list';
const CREATE_ROUTE_KEY = 'admin.city_pack_education_links_create';
const ACTION_ROUTE_KEY = 'admin.city_pack_education_links_action';

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
  const match = pathname.match(/^\/api\/admin\/city-pack-education-links\/([^/]+)\/(replace|retire)$/);
  if (!match) return null;
  return {
    id: decodeURIComponent(match[1]),
    action: match[2]
  };
}

function normalizeSchoolType(value) {
  const schoolType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return schoolType || 'unknown';
}

async function resolvePublicEducationLink(linkRegistryId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getLink = typeof resolvedDeps.getLink === 'function'
    ? resolvedDeps.getLink
    : linkRegistryRepo.getLink;
  const link = await getLink(linkRegistryId);
  if (!link) throw new Error('link registry entry not found');
  const schoolType = normalizeSchoolType(link.schoolType);
  if (schoolType !== 'public') throw new Error('link schoolType must be public');
  if (!link.url || typeof link.url !== 'string') throw new Error('link url required');
  return link;
}

function normalizeRegionKey(value) {
  if (typeof value !== 'string') return null;
  const regionKey = value.trim().toLowerCase();
  return regionKey || null;
}

function normalizeSchoolYear(value) {
  if (typeof value !== 'string') return null;
  const schoolYear = value.trim();
  return schoolYear || null;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)));
}

async function createCalendarLinkFromPayload(payload, traceId, deps) {
  const regionKey = normalizeRegionKey(payload.regionKey);
  const schoolYear = normalizeSchoolYear(payload.schoolYear);
  const linkRegistryId = typeof payload.linkRegistryId === 'string' ? payload.linkRegistryId.trim() : '';
  const usedByCityPackIds = normalizeStringArray(payload.usedByCityPackIds);
  if (!regionKey || !schoolYear || !linkRegistryId) {
    throw new Error('regionKey/schoolYear/linkRegistryId required');
  }
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const createSourceRef = typeof resolvedDeps.createSourceRef === 'function'
    ? resolvedDeps.createSourceRef
    : sourceRefsRepo.createSourceRef;
  const createSchoolCalendarLink = typeof resolvedDeps.createSchoolCalendarLink === 'function'
    ? resolvedDeps.createSchoolCalendarLink
    : schoolCalendarLinksRepo.createSchoolCalendarLink;
  const link = await resolvePublicEducationLink(linkRegistryId, deps);
  const sourceRef = await createSourceRef({
    url: link.url,
    status: 'needs_review',
    validUntil: payload.validUntil || null,
    riskLevel: 'medium',
    sourceType: 'official',
    requiredLevel: 'required',
    authorityLevel: 'local',
    schoolType: 'public',
    eduScope: link.eduScope || 'calendar',
    regionKey,
    domainClass: link.domainClass || 'school_public',
    usedByCityPackIds
  });
  const created = await createSchoolCalendarLink({
    regionKey,
    linkRegistryId: linkRegistryId,
    sourceRefId: sourceRef.id,
    schoolYear,
    status: 'active',
    validUntil: payload.validUntil || null,
    traceId
  });
  return {
    link,
    sourceRefId: sourceRef.id,
    schoolCalendarLinkId: created.id
  };
}

async function handleList(req, res, context, deps) {
  const url = new URL(req.url, 'http://localhost');
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const regionKey = url.searchParams.get('regionKey') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const schoolYear = url.searchParams.get('schoolYear') || undefined;
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const listSchoolCalendarLinks = typeof resolvedDeps.listSchoolCalendarLinks === 'function'
    ? resolvedDeps.listSchoolCalendarLinks
    : schoolCalendarLinksRepo.listSchoolCalendarLinks;
  const getLink = typeof resolvedDeps.getLink === 'function'
    ? resolvedDeps.getLink
    : linkRegistryRepo.getLink;
  const getSourceRef = typeof resolvedDeps.getSourceRef === 'function'
    ? resolvedDeps.getSourceRef
    : sourceRefsRepo.getSourceRef;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const rows = await listSchoolCalendarLinks({
    limit,
    regionKey,
    status,
    schoolYear
  });
  const items = [];
  for (const row of rows) {
    const link = row.linkRegistryId ? await getLink(row.linkRegistryId) : null;
    const sourceRef = row.sourceRefId ? await getSourceRef(row.sourceRefId) : null;
    items.push(Object.assign({}, row, {
      link: link ? {
        id: link.id,
        title: link.title || null,
        url: link.url || null,
        domainClass: link.domainClass || 'unknown',
        schoolType: link.schoolType || 'unknown',
        eduScope: link.eduScope || null,
        regionKey: link.regionKey || null,
        tags: Array.isArray(link.tags) ? link.tags : []
      } : null,
      sourceRef: sourceRef ? {
        id: sourceRef.id,
        status: sourceRef.status || null,
        validUntil: sourceRef.validUntil || null,
        lastResult: sourceRef.lastResult || null,
        confidenceScore: sourceRef.confidenceScore == null ? null : Number(sourceRef.confidenceScore)
      } : null
    }));
  }
  await appendAudit({
    actor: context.actor,
    action: 'city_pack.education_link.list',
    entityType: 'school_calendar_links',
    entityId: 'list',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      limit,
      count: items.length,
      regionKey: regionKey || null,
      status: status || null,
      schoolYear: schoolYear || null
    }
  });
  writeJson(res, LIST_ROUTE_KEY, 200, { ok: true, traceId: context.traceId, items }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleCreate(req, res, bodyText, context, deps) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const created = await createCalendarLinkFromPayload(payload, context.traceId, deps);
  await appendAudit({
    actor: context.actor,
    action: 'city_pack.education_link.create',
    entityType: 'school_calendar_links',
    entityId: created.schoolCalendarLinkId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      linkRegistryId: payload.linkRegistryId || null,
      sourceRefId: created.sourceRefId,
      regionKey: payload.regionKey || null,
      schoolYear: payload.schoolYear || null
    }
  });
  writeJson(res, CREATE_ROUTE_KEY, 201, {
    ok: true,
    traceId: context.traceId,
    schoolCalendarLinkId: created.schoolCalendarLinkId,
    sourceRefId: created.sourceRefId
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleReplace(req, res, bodyText, context, id, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getSchoolCalendarLink = typeof resolvedDeps.getSchoolCalendarLink === 'function'
    ? resolvedDeps.getSchoolCalendarLink
    : schoolCalendarLinksRepo.getSchoolCalendarLink;
  const updateSchoolCalendarLink = typeof resolvedDeps.updateSchoolCalendarLink === 'function'
    ? resolvedDeps.updateSchoolCalendarLink
    : schoolCalendarLinksRepo.updateSchoolCalendarLink;
  const updateSourceRef = typeof resolvedDeps.updateSourceRef === 'function'
    ? resolvedDeps.updateSourceRef
    : sourceRefsRepo.updateSourceRef;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const row = await getSchoolCalendarLink(id);
  if (!row) {
    writeJson(res, ACTION_ROUTE_KEY, 404, { ok: false, error: 'education link not found' }, {
      state: 'error',
      reason: 'education_link_not_found'
    });
    return;
  }
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const replacementLinkRegistryId = typeof payload.replacementLinkRegistryId === 'string'
    ? payload.replacementLinkRegistryId.trim()
    : '';
  if (!replacementLinkRegistryId) {
    writeJson(res, ACTION_ROUTE_KEY, 400, { ok: false, error: 'replacementLinkRegistryId required' }, {
      state: 'error',
      reason: 'replacement_link_registry_id_required'
    });
    return;
  }
  await updateSchoolCalendarLink(id, {
    status: 'archived',
    traceId: context.traceId
  });
  if (row.sourceRefId) {
    await updateSourceRef(row.sourceRefId, {
      status: 'retired',
      lastResult: 'replaced'
    });
  }
  const created = await createCalendarLinkFromPayload({
    regionKey: row.regionKey,
    schoolYear: row.schoolYear,
    linkRegistryId: replacementLinkRegistryId,
    validUntil: payload.validUntil || row.validUntil || null
  }, context.traceId, deps);
  await appendAudit({
    actor: context.actor,
    action: 'city_pack.education_link.replace',
    entityType: 'school_calendar_links',
    entityId: id,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      replacementId: created.schoolCalendarLinkId,
      oldSourceRefId: row.sourceRefId || null,
      newSourceRefId: created.sourceRefId,
      replacementLinkRegistryId
    }
  });
  writeJson(res, ACTION_ROUTE_KEY, 200, {
    ok: true,
    traceId: context.traceId,
    archivedId: id,
    replacementId: created.schoolCalendarLinkId,
    sourceRefId: created.sourceRefId
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleRetire(req, res, context, id, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getSchoolCalendarLink = typeof resolvedDeps.getSchoolCalendarLink === 'function'
    ? resolvedDeps.getSchoolCalendarLink
    : schoolCalendarLinksRepo.getSchoolCalendarLink;
  const updateSchoolCalendarLink = typeof resolvedDeps.updateSchoolCalendarLink === 'function'
    ? resolvedDeps.updateSchoolCalendarLink
    : schoolCalendarLinksRepo.updateSchoolCalendarLink;
  const updateSourceRef = typeof resolvedDeps.updateSourceRef === 'function'
    ? resolvedDeps.updateSourceRef
    : sourceRefsRepo.updateSourceRef;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const row = await getSchoolCalendarLink(id);
  if (!row) {
    writeJson(res, ACTION_ROUTE_KEY, 404, { ok: false, error: 'education link not found' }, {
      state: 'error',
      reason: 'education_link_not_found'
    });
    return;
  }
  await updateSchoolCalendarLink(id, {
    status: 'archived',
    traceId: context.traceId
  });
  if (row.sourceRefId) {
    await updateSourceRef(row.sourceRefId, {
      status: 'retired',
      lastResult: 'retired'
    });
  }
  await appendAudit({
    actor: context.actor,
    action: 'city_pack.education_link.retire',
    entityType: 'school_calendar_links',
    entityId: id,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      sourceRefId: row.sourceRefId || null,
      linkRegistryId: row.linkRegistryId || null
    }
  });
  writeJson(res, ACTION_ROUTE_KEY, 200, { ok: true, traceId: context.traceId, id }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleCityPackEducationLinks(req, res, bodyText, deps) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };
  let routeKey = LIST_ROUTE_KEY;

  try {
    if (req.method === 'GET' && pathname === '/api/admin/city-pack-education-links') {
      routeKey = LIST_ROUTE_KEY;
      await handleList(req, res, context, deps);
      return;
    }
    if (req.method === 'POST' && pathname === '/api/admin/city-pack-education-links') {
      routeKey = CREATE_ROUTE_KEY;
      await handleCreate(req, res, bodyText, context, deps);
      return;
    }
    if (req.method === 'POST') {
      const parsed = parseAction(pathname);
      if (parsed && parsed.action === 'replace') {
        routeKey = ACTION_ROUTE_KEY;
        await handleReplace(req, res, bodyText, context, parsed.id, deps);
        return;
      }
      if (parsed && parsed.action === 'retire') {
        routeKey = ACTION_ROUTE_KEY;
        await handleRetire(req, res, context, parsed.id, deps);
        return;
      }
    }
    writeJson(res, routeKey, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found'
    });
  } catch (err) {
    logRouteError('admin.city_pack_education_links', err, context);
    writeJson(res, routeKey, 500, { ok: false, error: err && err.message ? err.message : 'error' }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleCityPackEducationLinks
};
