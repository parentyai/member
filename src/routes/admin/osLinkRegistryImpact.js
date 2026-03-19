'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { isLinkRegistryImpactMapEnabled } = require('../../domain/tasks/featureFlags');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.os_link_registry_impact';

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const parsed = Number(url.searchParams.get('limit') || 500);
  if (!Number.isFinite(parsed) || parsed < 1) return 500;
  return Math.min(Math.floor(parsed), 1000);
}

function normalizeLinkState(link) {
  const row = link && typeof link === 'object' ? link : {};
  const state = normalizeText(row.lastHealth && row.lastHealth.state).toUpperCase();
  if (state) return state;
  return row.enabled === false ? 'DISABLED' : 'UNKNOWN';
}

function isWarnOrDisabled(link) {
  const row = link && typeof link === 'object' ? link : {};
  if (row.enabled === false) return true;
  return normalizeLinkState(row) === 'WARN';
}

function ensureImpactRow(map, link) {
  const id = normalizeText(link && link.id);
  if (!id) return null;
  if (!map.has(id)) {
    map.set(id, {
      id,
      state: normalizeLinkState(link),
      enabled: link && link.enabled !== false,
      domains: {
        task: 0,
        notification: 0,
        citypack: 0,
        vendor: 0
      },
      refCount: 0,
      refs: []
    });
  }
  return map.get(id);
}

function registerRef(row, domain, refType, refId) {
  if (!row) return;
  const key = normalizeText(domain);
  if (!key || !Object.prototype.hasOwnProperty.call(row.domains, key)) return;
  row.domains[key] += 1;
  row.refCount += 1;
  row.refs.push({
    domain: key,
    refType: normalizeText(refType),
    refId: normalizeText(refId)
  });
}

async function buildImpact(limit) {
  const [links, taskContents, notifications, cityPacks] = await Promise.all([
    linkRegistryRepo.listLinks({ limit }),
    taskContentsRepo.listTaskContents({ limit }),
    notificationsRepo.listNotifications({ limit, includeArchived: true, includeArchivedSeed: true }),
    cityPacksRepo.listCityPacks({ limit })
  ]);

  const impactMap = new Map();
  (Array.isArray(links) ? links : []).forEach((link) => {
    ensureImpactRow(impactMap, link);
  });

  (Array.isArray(taskContents) ? taskContents : []).forEach((content) => {
    const taskKey = normalizeText(content && content.taskKey) || '-';
    const linkIds = [];
    [content && content.videoLinkId, content && content.actionLinkId]
      .forEach((item) => {
        const value = normalizeText(item);
        if (!value || linkIds.includes(value)) return;
        linkIds.push(value);
      });
    (Array.isArray(content && content.recommendedVendorLinkIds) ? content.recommendedVendorLinkIds : []).forEach((item) => {
      const value = normalizeText(item);
      if (!value || linkIds.includes(value)) return;
      linkIds.push(value);
    });
    linkIds.forEach((linkId) => {
      const row = ensureImpactRow(impactMap, { id: linkId });
      registerRef(row, 'task', 'task_content', taskKey);
    });
  });

  (Array.isArray(notifications) ? notifications : []).forEach((notification) => {
    const notificationId = normalizeText(notification && notification.id) || '-';
    const linkIds = [];
    const primary = normalizeText(notification && notification.linkRegistryId);
    if (primary) linkIds.push(primary);
    const secondary = Array.isArray(notification && notification.secondaryCtas) ? notification.secondaryCtas : [];
    secondary.forEach((item) => {
      const value = normalizeText(item && item.linkRegistryId);
      if (!value || linkIds.includes(value)) return;
      linkIds.push(value);
    });
    const fallback = normalizeText(
      notification
      && notification.cityPackFallback
      && notification.cityPackFallback.fallbackLinkRegistryId
    );
    if (fallback && !linkIds.includes(fallback)) linkIds.push(fallback);
    linkIds.forEach((linkId) => {
      const row = ensureImpactRow(impactMap, { id: linkId });
      registerRef(row, 'notification', 'notification', notificationId);
    });
  });

  (Array.isArray(cityPacks) ? cityPacks : []).forEach((cityPack) => {
    const cityPackId = normalizeText(cityPack && cityPack.id) || '-';
    const slotContents = cityPack && cityPack.slotContents && typeof cityPack.slotContents === 'object'
      ? cityPack.slotContents
      : {};
    Object.keys(slotContents).forEach((slotKey) => {
      const linkId = normalizeText(slotContents[slotKey] && slotContents[slotKey].linkRegistryId);
      if (!linkId) return;
      const row = ensureImpactRow(impactMap, { id: linkId });
      registerRef(row, 'citypack', `slot:${slotKey}`, cityPackId);
    });
  });

  (Array.isArray(links) ? links : []).forEach((link) => {
    const isVendor = Boolean(normalizeText(link && link.vendorKey) || normalizeText(link && link.vendorLabel) || normalizeText(link && link.intentTag) === 'vendor');
    if (!isVendor) return;
    const row = ensureImpactRow(impactMap, link);
    registerRef(row, 'vendor', 'vendor_facade', normalizeText(link && link.id) || '-');
  });

  const items = Array.from(impactMap.values()).map((item) => {
    const domainCount = Object.values(item.domains).filter((count) => Number(count) > 0).length;
    const shared = domainCount >= 2;
    return {
      id: item.id,
      state: item.state,
      enabled: item.enabled,
      domainCount,
      refCount: item.refCount,
      shared,
      domains: item.domains,
      refs: item.refs
    };
  }).sort((left, right) => {
    const sharedCompare = Number(right.shared === true) - Number(left.shared === true);
    if (sharedCompare !== 0) return sharedCompare;
    const domainCompare = Number(right.domainCount || 0) - Number(left.domainCount || 0);
    if (domainCompare !== 0) return domainCompare;
    const refCompare = Number(right.refCount || 0) - Number(left.refCount || 0);
    if (refCompare !== 0) return refCompare;
    return String(left.id || '').localeCompare(String(right.id || ''), 'ja');
  });

  const linksById = new Map((Array.isArray(links) ? links : [])
    .filter((item) => item && item.id)
    .map((item) => [item.id, item]));
  const referenced = items.filter((item) => Number(item.refCount || 0) > 0);
  const shared = items.filter((item) => item.shared === true);
  const referencedWarnOrDisabledCount = referenced.filter((item) => isWarnOrDisabled(linksById.get(item.id))).length;
  const sharedWarnOrDisabledCount = shared.filter((item) => isWarnOrDisabled(linksById.get(item.id))).length;

  return {
    items,
    summary: {
      total: items.length,
      referencedIdCount: referenced.length,
      sharedIdCount: shared.length,
      referencedWarnOrDisabledCount,
      sharedWarnOrDisabledCount
    }
  };
}

async function handleImpact(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  if (!isLinkRegistryImpactMapEnabled()) {
    writeJson(res, 409, { ok: false, error: 'link_registry_impact_map_disabled', traceId, requestId }, {
      state: 'blocked',
      reason: 'link_registry_impact_map_disabled'
    });
    return;
  }
  try {
    const limit = resolveLimit(req);
    const impact = await buildImpact(limit);
    await appendAuditLog({
      actor,
      action: 'link_registry.impact.view',
      entityType: 'link_registry',
      entityId: 'impact_map',
      traceId,
      requestId,
      payloadSummary: {
        limit,
        total: impact.summary.total,
        sharedIdCount: impact.summary.sharedIdCount,
        referencedWarnOrDisabledCount: impact.summary.referencedWarnOrDisabledCount
      }
    });
    writeJson(res, 200, Object.assign({
      ok: true,
      traceId,
      requestId
    }, impact), {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError('admin.os_link_registry.impact', err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleImpact
};
