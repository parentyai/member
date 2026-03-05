'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { isLinkRegistryImpactMapEnabled } = require('../../domain/tasks/featureFlags');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

function normalizeLimit(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function toState(row) {
  const payload = row && typeof row === 'object' ? row : {};
  if (payload.enabled === false) return 'disabled';
  const healthState = normalizeText(payload.lastHealth && payload.lastHealth.state, '').toUpperCase();
  if (healthState === 'WARN') return 'WARN';
  if (healthState === 'OK') return 'OK';
  if (healthState) return healthState;
  return 'unknown';
}

function isWarnOrDisabled(row) {
  const state = toState(row);
  return state === 'disabled' || state === 'WARN';
}

function isVendorFacadeRow(row) {
  const payload = row && typeof row === 'object' ? row : {};
  const category = normalizeText(payload.category, '').toLowerCase();
  const vendorKey = normalizeText(payload.vendorKey, '').toLowerCase();
  const vendorLabel = normalizeText(payload.vendorLabel, '').toLowerCase();
  const title = normalizeText(payload.title, '').toLowerCase();
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((item) => normalizeText(item, '').toLowerCase()).filter(Boolean)
    : [];
  return category.includes('vendor')
    || vendorKey.length > 0
    || vendorLabel.length > 0
    || title.includes('[vendor_link]')
    || tags.some((item) => item.includes('vendor'));
}

function ensureItem(map, linkRow) {
  const id = normalizeText(linkRow && linkRow.id, '');
  if (!id) return null;
  if (map.has(id)) return map.get(id);
  const item = {
    id,
    label: normalizeText(linkRow && (linkRow.label || linkRow.title), null),
    title: normalizeText(linkRow && linkRow.title, null),
    url: normalizeText(linkRow && linkRow.url, null),
    state: toState(linkRow),
    enabled: linkRow && linkRow.enabled !== false,
    warnOrDisabled: isWarnOrDisabled(linkRow),
    refs: {
      task_contents: [],
      notifications: [],
      city_packs: [],
      vendor_facade: []
    },
    domainCount: 0,
    refCount: 0,
    shared: false
  };
  map.set(id, item);
  return item;
}

function addRef(item, domain, payload) {
  if (!item || !domain) return;
  if (!item.refs[domain]) item.refs[domain] = [];
  item.refs[domain].push(payload);
}

function finalizeItem(item) {
  const domains = ['task_contents', 'notifications', 'city_packs', 'vendor_facade'];
  const domainCount = domains.reduce((sum, domain) => sum + (item.refs[domain].length > 0 ? 1 : 0), 0);
  const refCount = domains.reduce((sum, domain) => sum + item.refs[domain].length, 0);
  return Object.assign({}, item, {
    domainCount,
    refCount,
    shared: domainCount >= 2
  });
}

function collectNotificationRefs(map, notifications) {
  const rows = Array.isArray(notifications) ? notifications : [];
  rows.forEach((row) => {
    const item = row && typeof row === 'object' ? row : {};
    const notificationId = normalizeText(item.id, null);
    const primary = normalizeText(item.linkRegistryId, null);
    if (primary && map.has(primary)) {
      addRef(map.get(primary), 'notifications', { docId: notificationId, field: 'linkRegistryId' });
    }
    const secondary = Array.isArray(item.secondaryCtas) ? item.secondaryCtas : [];
    secondary.forEach((cta, index) => {
      const ctaId = normalizeText(cta && cta.linkRegistryId, null);
      if (!ctaId || !map.has(ctaId)) return;
      addRef(map.get(ctaId), 'notifications', { docId: notificationId, field: `secondaryCtas[${index}].linkRegistryId` });
    });
    const fallbackId = normalizeText(item && item.cityPackFallback && item.cityPackFallback.fallbackLinkRegistryId, null);
    if (fallbackId && map.has(fallbackId)) {
      addRef(map.get(fallbackId), 'notifications', { docId: notificationId, field: 'cityPackFallback.fallbackLinkRegistryId' });
    }
  });
}

function collectTaskContentRefs(map, taskContents) {
  const rows = Array.isArray(taskContents) ? taskContents : [];
  rows.forEach((row) => {
    const item = row && typeof row === 'object' ? row : {};
    const taskKey = normalizeText(item.taskKey, null);
    const video = normalizeText(item.videoLinkId, null);
    const action = normalizeText(item.actionLinkId, null);
    if (video && map.has(video)) {
      addRef(map.get(video), 'task_contents', { docId: taskKey, field: 'videoLinkId' });
    }
    if (action && map.has(action)) {
      addRef(map.get(action), 'task_contents', { docId: taskKey, field: 'actionLinkId' });
    }
  });
}

function collectCityPackRefs(map, cityPacks) {
  const rows = Array.isArray(cityPacks) ? cityPacks : [];
  rows.forEach((row) => {
    const item = row && typeof row === 'object' ? row : {};
    const cityPackId = normalizeText(item.id, null);
    const slotContents = item.slotContents && typeof item.slotContents === 'object' ? item.slotContents : {};
    Object.keys(slotContents).forEach((slotKey) => {
      const slot = slotContents[slotKey] && typeof slotContents[slotKey] === 'object' ? slotContents[slotKey] : {};
      const linkRegistryId = normalizeText(slot.linkRegistryId, null);
      if (!linkRegistryId || !map.has(linkRegistryId)) return;
      addRef(map.get(linkRegistryId), 'city_packs', {
        docId: cityPackId,
        field: `slotContents.${slotKey}.linkRegistryId`
      });
    });

    const slots = Array.isArray(item.slots) ? item.slots : [];
    slots.forEach((slot, index) => {
      const fallbackId = normalizeText(slot && slot.fallbackLinkRegistryId, null);
      if (!fallbackId || !map.has(fallbackId)) return;
      addRef(map.get(fallbackId), 'city_packs', {
        docId: cityPackId,
        field: `slots[${index}].fallbackLinkRegistryId`
      });
    });
  });
}

function collectVendorRefs(map, links) {
  const rows = Array.isArray(links) ? links : [];
  rows.forEach((row) => {
    const id = normalizeText(row && row.id, '');
    if (!id || !map.has(id)) return;
    if (!isVendorFacadeRow(row)) return;
    addRef(map.get(id), 'vendor_facade', { field: 'vendors_api_projection' });
  });
}

function buildSummary(items) {
  const rows = Array.isArray(items) ? items : [];
  const sharedIdCount = rows.filter((item) => item.domainCount >= 2).length;
  const sharedWarnOrDisabledCount = rows.filter((item) => item.domainCount >= 2 && item.warnOrDisabled).length;
  const referencedWarnOrDisabledCount = rows.filter((item) => item.refCount > 0 && item.warnOrDisabled).length;
  return {
    total: rows.length,
    sharedIdCount,
    sharedWarnOrDisabledCount,
    referencedWarnOrDisabledCount
  };
}

async function handleLinkRegistryImpact(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  if (!isLinkRegistryImpactMapEnabled()) {
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'link_registry_impact_map_disabled', traceId, requestId }));
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const limit = normalizeLimit(url.searchParams.get('limit'), 500, 1000);

  try {
    const [links, taskContents, notifications, cityPacks] = await Promise.all([
      linkRegistryRepo.listLinks({ limit }),
      taskContentsRepo.listTaskContents({ limit: 500 }).catch(() => []),
      notificationsRepo.listNotifications({ limit: 2000, includeArchived: true, includeArchivedSeed: true }).catch(() => []),
      cityPacksRepo.listCityPacks({ limit: 200 }).catch(() => [])
    ]);

    const map = new Map();
    (Array.isArray(links) ? links : []).forEach((row) => {
      ensureItem(map, row);
    });

    collectTaskContentRefs(map, taskContents);
    collectNotificationRefs(map, notifications);
    collectCityPackRefs(map, cityPacks);
    collectVendorRefs(map, links);

    const items = Array.from(map.values())
      .map((item) => finalizeItem(item))
      .sort((left, right) => {
        const byShared = Number(right.shared === true) - Number(left.shared === true);
        if (byShared !== 0) return byShared;
        const byRefs = Number(right.refCount || 0) - Number(left.refCount || 0);
        if (byRefs !== 0) return byRefs;
        return String(left.id || '').localeCompare(String(right.id || ''), 'ja');
      });

    const summary = buildSummary(items);

    await appendAuditLog({
      actor,
      action: 'link_registry.impact.view',
      entityType: 'link_registry',
      entityId: 'impact_map',
      traceId,
      requestId,
      payloadSummary: {
        limit,
        total: summary.total,
        sharedIdCount: summary.sharedIdCount,
        referencedWarnOrDisabledCount: summary.referencedWarnOrDisabledCount
      }
    });

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      summary,
      items
    }));
  } catch (err) {
    logRouteError('admin.os_link_registry_impact', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleLinkRegistryImpact
};
