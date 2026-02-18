'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { updateLink } = require('../../usecases/linkRegistry/updateLink');
const { checkLinkHealth } = require('../../usecases/linkRegistry/checkLinkHealth');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  resolveActor,
  resolveRequestId,
  resolveTraceId,
  parseJson
} = require('./osContext');

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 50;
  return Math.min(Math.floor(num), 200);
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
  const actor = resolveActor(req);
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  if (req.method === 'GET' && pathname === '/api/admin/vendors') {
    await handleList(req, res, actor, traceId, requestId);
    return;
  }
  const actionMatch = pathname.match(/^\/api\/admin\/vendors\/([^/]+)\/(edit|activate|disable)$/);
  if (req.method === 'POST' && actionMatch) {
    const linkId = decodeURIComponent(actionMatch[1]);
    const action = actionMatch[2];
    if (action === 'edit') {
      await handleEdit(req, res, actor, traceId, requestId, linkId, bodyText);
      return;
    }
    if (action === 'activate') {
      await handleSetHealth(res, actor, traceId, requestId, linkId, 'OK', 200, 'vendors.activate');
      return;
    }
    if (action === 'disable') {
      await handleSetHealth(res, actor, traceId, requestId, linkId, 'WARN', 409, 'vendors.disable');
      return;
    }
  }
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
}

module.exports = {
  handleVendors
};
