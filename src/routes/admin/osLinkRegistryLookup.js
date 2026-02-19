'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

async function handleLookup(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const match = req.url && req.url.match(/^\/api\/admin\/os\/link-registry\/([^/?#]+)/);
  const linkId = match && match[1] ? decodeURIComponent(match[1]) : '';
  if (!linkId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'linkRegistryId required', traceId, requestId }));
    return;
  }
  try {
    const row = await linkRegistryRepo.getLink(linkId);
    if (!row) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'link not found', traceId, requestId }));
      return;
    }
    await appendAuditLog({
      actor,
      action: 'notifications.link_registry.lookup',
      entityType: 'link_registry',
      entityId: linkId,
      traceId,
      requestId,
      payloadSummary: { linkRegistryId: linkId }
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      item: {
        id: row.id,
        url: row.url || null,
        label: row.label || row.title || null,
        title: row.title || null,
        vendorKey: row.vendorKey || null,
        vendorLabel: row.vendorLabel || null,
        state: row.lastHealth && row.lastHealth.state ? row.lastHealth.state : null
      }
    }));
  } catch (err) {
    logRouteError('admin.os_link_registry.lookup', err, { traceId, requestId, actor, linkId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleLookup
};
