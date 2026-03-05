'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function addRef(map, linkId, ref) {
  const id = normalizeText(linkId);
  if (!id) return;
  const current = map.get(id) || [];
  current.push(ref);
  map.set(id, current);
}

function normalizeState(link) {
  if (!link || typeof link !== 'object') return 'unknown';
  if (link.enabled === false) return 'disabled';
  const state = normalizeText(link.lastHealth && link.lastHealth.state).toUpperCase();
  if (!state) return 'unknown';
  if (state === 'WARN') return 'WARN';
  if (state === 'OK') return 'OK';
  if (state === 'BLOCKED') return 'blocked';
  return state;
}

async function handleImpact(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  try {
    const [links, notifications, cityPacks, taskContents] = await Promise.all([
      linkRegistryRepo.listLinks({ limit: 1000 }),
      notificationsRepo.listNotifications({ includeArchived: true, includeArchivedSeed: true, limit: 1000 }).catch(() => []),
      cityPacksRepo.listCityPacks({ limit: 500 }).catch(() => []),
      taskContentsRepo.listTaskContents({ limit: 1000 }).catch(() => [])
    ]);

    const refMap = new Map();

    (Array.isArray(taskContents) ? taskContents : []).forEach((row) => {
      addRef(refMap, row.videoLinkId, { domain: 'task', refType: 'videoLinkId', refId: row.taskKey });
      addRef(refMap, row.actionLinkId, { domain: 'task', refType: 'actionLinkId', refId: row.taskKey });
      const vendors = Array.isArray(row.recommendedVendorLinkIds) ? row.recommendedVendorLinkIds : [];
      vendors.forEach((id) => addRef(refMap, id, { domain: 'task', refType: 'recommendedVendorLinkIds', refId: row.taskKey }));
    });

    (Array.isArray(notifications) ? notifications : []).forEach((row) => {
      addRef(refMap, row.linkRegistryId, { domain: 'notification', refType: 'linkRegistryId', refId: row.id });
      const secondary = Array.isArray(row.secondaryCtas) ? row.secondaryCtas : [];
      secondary.forEach((cta, index) => {
        addRef(refMap, cta && cta.linkRegistryId, { domain: 'notification', refType: `secondaryCtas[${index}]`, refId: row.id });
      });
      if (row.cityPackFallback && typeof row.cityPackFallback === 'object') {
        addRef(refMap, row.cityPackFallback.fallbackLinkRegistryId, {
          domain: 'notification',
          refType: 'cityPackFallback',
          refId: row.id
        });
      }
    });

    (Array.isArray(cityPacks) ? cityPacks : []).forEach((row) => {
      const slotContents = row && row.slotContents && typeof row.slotContents === 'object' ? row.slotContents : {};
      Object.keys(slotContents).forEach((slotKey) => {
        const slot = slotContents[slotKey];
        addRef(refMap, slot && slot.linkRegistryId, { domain: 'city_pack', refType: `slotContents.${slotKey}`, refId: row.id });
      });
      const slots = Array.isArray(row && row.slots) ? row.slots : [];
      slots.forEach((slot, index) => {
        addRef(refMap, slot && slot.fallbackLinkRegistryId, { domain: 'city_pack', refType: `slots[${index}].fallbackLinkRegistryId`, refId: row.id });
      });
    });

    (Array.isArray(links) ? links : []).forEach((row) => {
      if (normalizeText(row.vendorKey) || normalizeText(row.vendorLabel)) {
        addRef(refMap, row.id, { domain: 'vendor', refType: 'vendor_facade', refId: row.id });
      }
    });

    const items = (Array.isArray(links) ? links : []).map((link) => {
      const refs = refMap.get(link.id) || [];
      const domains = Array.from(new Set(refs.map((ref) => ref.domain)));
      return {
        id: link.id,
        state: normalizeState(link),
        refCount: refs.length,
        domainCount: domains.length,
        shared: domains.length > 1,
        domains,
        refs
      };
    });

    const sharedIdCount = items.filter((item) => item.shared).length;
    const referencedWarnOrDisabledCount = items.filter((item) => item.refCount > 0 && ['WARN', 'disabled', 'blocked'].includes(item.state)).length;
    const sharedWarnOrDisabledCount = items.filter((item) => item.shared && ['WARN', 'disabled', 'blocked'].includes(item.state)).length;

    await appendAuditLog({
      actor,
      action: 'link_registry.impact.view',
      entityType: 'link_registry',
      entityId: 'impact_map',
      traceId,
      requestId,
      payloadSummary: {
        linkCount: items.length,
        sharedIdCount,
        referencedWarnOrDisabledCount,
        sharedWarnOrDisabledCount
      }
    }).catch(() => null);

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      summary: {
        linkCount: items.length,
        sharedIdCount,
        referencedWarnOrDisabledCount,
        sharedWarnOrDisabledCount
      },
      items
    }));
  } catch (err) {
    logRouteError('admin.os_link_registry_impact', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleImpact
};
