'use strict';

const schoolCalendarLinksRepo = require('../../repos/firestore/schoolCalendarLinksRepo');
const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
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

async function resolvePublicEducationLink(linkRegistryId) {
  const link = await linkRegistryRepo.getLink(linkRegistryId);
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

async function createCalendarLinkFromPayload(payload, traceId) {
  const regionKey = normalizeRegionKey(payload.regionKey);
  const schoolYear = normalizeSchoolYear(payload.schoolYear);
  const linkRegistryId = typeof payload.linkRegistryId === 'string' ? payload.linkRegistryId.trim() : '';
  const usedByCityPackIds = normalizeStringArray(payload.usedByCityPackIds);
  if (!regionKey || !schoolYear || !linkRegistryId) {
    throw new Error('regionKey/schoolYear/linkRegistryId required');
  }
  const link = await resolvePublicEducationLink(linkRegistryId);
  const sourceRef = await sourceRefsRepo.createSourceRef({
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
  const created = await schoolCalendarLinksRepo.createSchoolCalendarLink({
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

async function handleList(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const regionKey = url.searchParams.get('regionKey') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const schoolYear = url.searchParams.get('schoolYear') || undefined;
  const rows = await schoolCalendarLinksRepo.listSchoolCalendarLinks({
    limit,
    regionKey,
    status,
    schoolYear
  });
  const items = [];
  for (const row of rows) {
    const link = row.linkRegistryId ? await linkRegistryRepo.getLink(row.linkRegistryId) : null;
    const sourceRef = row.sourceRefId ? await sourceRefsRepo.getSourceRef(row.sourceRefId) : null;
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
  await appendAuditLog({
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
  writeJson(res, 200, { ok: true, traceId: context.traceId, items });
}

async function handleCreate(req, res, bodyText, context) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const created = await createCalendarLinkFromPayload(payload, context.traceId);
  await appendAuditLog({
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
  writeJson(res, 201, {
    ok: true,
    traceId: context.traceId,
    schoolCalendarLinkId: created.schoolCalendarLinkId,
    sourceRefId: created.sourceRefId
  });
}

async function handleReplace(req, res, bodyText, context, id) {
  const row = await schoolCalendarLinksRepo.getSchoolCalendarLink(id);
  if (!row) {
    writeJson(res, 404, { ok: false, error: 'education link not found' });
    return;
  }
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const replacementLinkRegistryId = typeof payload.replacementLinkRegistryId === 'string'
    ? payload.replacementLinkRegistryId.trim()
    : '';
  if (!replacementLinkRegistryId) {
    writeJson(res, 400, { ok: false, error: 'replacementLinkRegistryId required' });
    return;
  }
  await schoolCalendarLinksRepo.updateSchoolCalendarLink(id, {
    status: 'archived',
    traceId: context.traceId
  });
  if (row.sourceRefId) {
    await sourceRefsRepo.updateSourceRef(row.sourceRefId, {
      status: 'retired',
      lastResult: 'replaced'
    });
  }
  const created = await createCalendarLinkFromPayload({
    regionKey: row.regionKey,
    schoolYear: row.schoolYear,
    linkRegistryId: replacementLinkRegistryId,
    validUntil: payload.validUntil || row.validUntil || null
  }, context.traceId);
  await appendAuditLog({
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
  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    archivedId: id,
    replacementId: created.schoolCalendarLinkId,
    sourceRefId: created.sourceRefId
  });
}

async function handleRetire(req, res, context, id) {
  const row = await schoolCalendarLinksRepo.getSchoolCalendarLink(id);
  if (!row) {
    writeJson(res, 404, { ok: false, error: 'education link not found' });
    return;
  }
  await schoolCalendarLinksRepo.updateSchoolCalendarLink(id, {
    status: 'archived',
    traceId: context.traceId
  });
  if (row.sourceRefId) {
    await sourceRefsRepo.updateSourceRef(row.sourceRefId, {
      status: 'retired',
      lastResult: 'retired'
    });
  }
  await appendAuditLog({
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
  writeJson(res, 200, { ok: true, traceId: context.traceId, id });
}

async function handleCityPackEducationLinks(req, res, bodyText) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };

  try {
    if (req.method === 'GET' && pathname === '/api/admin/city-pack-education-links') {
      await handleList(req, res, context);
      return;
    }
    if (req.method === 'POST' && pathname === '/api/admin/city-pack-education-links') {
      await handleCreate(req, res, bodyText, context);
      return;
    }
    if (req.method === 'POST') {
      const parsed = parseAction(pathname);
      if (parsed && parsed.action === 'replace') {
        await handleReplace(req, res, bodyText, context, parsed.id);
        return;
      }
      if (parsed && parsed.action === 'retire') {
        await handleRetire(req, res, context, parsed.id);
        return;
      }
    }
    writeJson(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    logRouteError('admin.city_pack_education_links', err, context);
    writeJson(res, 500, { ok: false, error: err && err.message ? err.message : 'error' });
  }
}

module.exports = {
  handleCityPackEducationLinks
};
