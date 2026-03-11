'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const { updateLink } = require('../../usecases/linkRegistry/updateLink');
const { checkLinkHealth } = require('../../usecases/linkRegistry/checkLinkHealth');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { enforceManagedFlowGuard } = require('./managedFlowGuard');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  parseJson
} = require('./osContext');

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 50;
  return Math.min(Math.floor(num), 200);
}

function normalizeShadowLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 20;
  return Math.min(Math.floor(num), 100);
}

function resolveHost(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return new URL(value).host || null;
  } catch (_err) {
    return null;
  }
}

function normalizeVendorItem(item) {
  const row = item && typeof item === 'object' ? item : {};
  const host = resolveHost(row.url);
  const health = row.lastHealth && typeof row.lastHealth === 'object' ? row.lastHealth : {};
  return {
    id: row.id || null,
    vendorKey: row.vendorKey || host || 'unknown',
    vendorLabel: row.vendorLabel || host || row.vendorKey || 'unknown',
    url: row.url || null,
    healthState: health.state || 'UNKNOWN',
    statusCode: Number.isFinite(health.statusCode) ? health.statusCode : null,
    checkedAt: health.checkedAt || null,
    title: row.title || null,
    lastHealth: health
  };
}

async function writeVendorAudit(context) {
  await appendAuditLog({
    actor: context.actor,
    action: context.action,
    entityType: 'vendors',
    entityId: context.entityId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: context.payloadSummary || {}
  });
}

async function handleList(req, res, actor, traceId, requestId) {
  const url = new URL(req.url, 'http://localhost');
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const state = url.searchParams.get('state') || undefined;
  const rows = await linkRegistryRepo.listLinks({ limit, state });
  const items = rows.map(normalizeVendorItem);
  await writeVendorAudit({
    actor,
    action: 'vendors.list',
    entityId: 'vendors',
    traceId,
    requestId,
    payloadSummary: { limit, state: state || null, count: items.length }
  });
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, traceId, items }));
}

function normalizeShadowItem(item) {
  const row = item && typeof item === 'object' ? item : {};
  const ref = row.ref && typeof row.ref === 'object' ? row.ref : {};
  const shadow = row.shadow && typeof row.shadow === 'object' ? row.shadow : {};
  const scored = Array.isArray(shadow.items) ? shadow.items : [];
  return {
    eventId: row.id || null,
    createdAt: row.createdAt || null,
    traceId: row.traceId || shadow.traceId || null,
    requestId: row.requestId || null,
    lineUserId: row.lineUserId || null,
    todoKey: ref.todoKey || null,
    sortApplied: ref.sortApplied === true,
    currentOrderLinkIds: Array.isArray(shadow.currentOrderLinkIds) ? shadow.currentOrderLinkIds : [],
    rankedLinkIds: Array.isArray(shadow.rankedLinkIds) ? shadow.rankedLinkIds : [],
    scores: scored.map((scoreRow) => {
      const score = scoreRow && typeof scoreRow === 'object' ? scoreRow : {};
      return {
        linkId: score.linkId || null,
        relevanceScore: Number.isFinite(Number(score.relevanceScore)) ? Number(score.relevanceScore) : null,
        scoreBreakdown: score.scoreBreakdown && typeof score.scoreBreakdown === 'object' ? score.scoreBreakdown : {},
        explanationCodes: Array.isArray(score.explanationCodes) ? score.explanationCodes : [],
        legacyHealthy: score.legacyHealthy === true,
        healthState: typeof score.healthState === 'string' && score.healthState.trim()
          ? score.healthState.trim()
          : 'UNKNOWN'
      };
    }),
    raw: row
  };
}

function hasDifferentOrder(currentOrderLinkIds, rankedLinkIds) {
  const current = Array.isArray(currentOrderLinkIds) ? currentOrderLinkIds : [];
  const ranked = Array.isArray(rankedLinkIds) ? rankedLinkIds : [];
  if (current.length !== ranked.length) return current.length > 0 || ranked.length > 0;
  for (let i = 0; i < current.length; i += 1) {
    if (current[i] !== ranked[i]) return true;
  }
  return false;
}

function buildShadowRelevanceSummary(items) {
  const rows = Array.isArray(items) ? items : [];
  const todoKeyCounts = new Map();
  let sortAppliedCount = 0;
  let divergenceCount = 0;
  let latestCreatedAt = null;

  rows.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (item.sortApplied === true) sortAppliedCount += 1;
    if (hasDifferentOrder(item.currentOrderLinkIds, item.rankedLinkIds)) divergenceCount += 1;
    const todoKey = typeof item.todoKey === 'string' && item.todoKey.trim() ? item.todoKey.trim() : 'unknown';
    todoKeyCounts.set(todoKey, (todoKeyCounts.get(todoKey) || 0) + 1);
    if (typeof item.createdAt === 'string' && item.createdAt.trim()) {
      if (!latestCreatedAt || item.createdAt > latestCreatedAt) latestCreatedAt = item.createdAt;
    }
  });

  const totalEvents = rows.length;
  const todoKeyDistribution = Array.from(todoKeyCounts.entries())
    .map(([todoKey, count]) => ({ todoKey, count }))
    .sort((a, b) => b.count - a.count || a.todoKey.localeCompare(b.todoKey))
    .slice(0, 10);

  return {
    totalEvents,
    sortAppliedCount,
    sortAppliedRate: totalEvents > 0 ? Number((sortAppliedCount / totalEvents).toFixed(4)) : 0,
    orderDivergenceCount: divergenceCount,
    orderDivergenceRate: totalEvents > 0 ? Number((divergenceCount / totalEvents).toFixed(4)) : 0,
    latestCreatedAt,
    todoKeyDistribution
  };
}

async function handleShadowRelevanceList(req, res, actor, traceId, requestId) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = typeof url.searchParams.get('lineUserId') === 'string'
    ? url.searchParams.get('lineUserId').trim()
    : '';
  const todoKey = typeof url.searchParams.get('todoKey') === 'string'
    ? url.searchParams.get('todoKey').trim()
    : '';
  const limit = normalizeShadowLimit(url.searchParams.get('limit'));
  if (!lineUserId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId required' }));
    return;
  }
  const rows = await eventsRepo.listEventsByType({
    type: 'todo_vendor_shadow_scored',
    lineUserId,
    todoKey: todoKey || null,
    limit,
    scanLimit: Math.min(limit * 10, 1000)
  });
  const items = rows.map(normalizeShadowItem);
  const summary = buildShadowRelevanceSummary(items);
  await writeVendorAudit({
    actor,
    action: 'vendors.shadow_relevance.list',
    entityId: lineUserId,
    traceId,
    requestId,
    payloadSummary: {
      lineUserId,
      todoKey: todoKey || null,
      limit,
      count: items.length,
      sortAppliedCount: summary.sortAppliedCount,
      orderDivergenceCount: summary.orderDivergenceCount
    }
  });
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, traceId, items, summary }));
}

async function handleEdit(req, res, actor, traceId, requestId, linkId, bodyText) {
  const body = parseJson(bodyText, res);
  if (!body) return;
  const patch = {};
  if (typeof body.title === 'string') patch.title = body.title.trim();
  if (typeof body.vendorLabel === 'string') patch.vendorLabel = body.vendorLabel.trim();
  if (typeof body.vendorKey === 'string') patch.vendorKey = body.vendorKey.trim();
  if (typeof body.url === 'string') patch.url = body.url.trim();
  if (!Object.keys(patch).length) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'patch fields required' }));
    return;
  }
  await updateLink(linkId, patch);
  await writeVendorAudit({
    actor,
    action: 'vendors.edit',
    entityId: linkId,
    traceId,
    requestId,
    payloadSummary: { fields: Object.keys(patch) }
  });
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, traceId, id: linkId }));
}

async function handleSetHealth(res, actor, traceId, requestId, linkId, state, statusCode, action) {
  await checkLinkHealth(linkId, {
    state,
    statusCode,
    checkedAt: new Date().toISOString()
  });
  await writeVendorAudit({
    actor,
    action,
    entityId: linkId,
    traceId,
    requestId,
    payloadSummary: { state, statusCode }
  });
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, traceId, id: linkId }));
}

async function handleVendors(req, res, bodyText) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  if (req.method === 'GET' && pathname === '/api/admin/vendors') {
    await handleList(req, res, actor, traceId, requestId);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/admin/vendors/shadow-relevance') {
    await handleShadowRelevanceList(req, res, actor, traceId, requestId);
    return;
  }
  const actionMatch = pathname.match(/^\/api\/admin\/vendors\/([^/]+)\/(edit|activate|disable)$/);
  if (req.method === 'POST' && actionMatch) {
    const linkId = decodeURIComponent(actionMatch[1]);
    const action = actionMatch[2];
    const actionKey = action === 'edit'
      ? 'vendors.edit'
      : (action === 'activate' ? 'vendors.activate' : 'vendors.disable');
    const guard = await enforceManagedFlowGuard({
      req,
      res,
      actionKey,
      payload: {}
    });
    if (!guard) return;
    const guardedActor = guard.actor || actor;
    const guardedTraceId = guard.traceId || traceId;
    if (action === 'edit') {
      await handleEdit(req, res, guardedActor, guardedTraceId, requestId, linkId, bodyText);
      return;
    }
    if (action === 'activate') {
      await handleSetHealth(res, guardedActor, guardedTraceId, requestId, linkId, 'OK', 200, 'vendors.activate');
      return;
    }
    if (action === 'disable') {
      await handleSetHealth(res, guardedActor, guardedTraceId, requestId, linkId, 'WARN', 409, 'vendors.disable');
      return;
    }
  }
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
}

module.exports = {
  handleVendors
};
