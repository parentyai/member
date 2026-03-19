'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.os_link_registry_lookup';

function normalizeOutcomeOptions(outcomeOptions) {
  const input = outcomeOptions && typeof outcomeOptions === 'object' ? outcomeOptions : {};
  const guard = input.guard && typeof input.guard === 'object' ? input.guard : {};
  return Object.assign({}, input, {
    routeType: ROUTE_TYPE,
    guard: Object.assign({}, guard, { routeKey: ROUTE_KEY })
  });
}

function writeJson(res, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleLookup(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const match = req.url && req.url.match(/^\/api\/admin\/os\/link-registry\/([^/?#]+)/);
  const linkId = match && match[1] ? decodeURIComponent(match[1]) : '';
  if (!linkId) {
    writeJson(res, 400, { ok: false, error: 'linkRegistryId required', traceId, requestId }, {
      state: 'error',
      reason: 'link_registry_id_required'
    });
    return;
  }
  try {
    const row = await linkRegistryRepo.getLink(linkId);
    if (!row) {
      writeJson(res, 404, { ok: false, error: 'link not found', traceId, requestId }, {
        state: 'error',
        reason: 'link_not_found'
      });
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
    writeJson(res, 200, {
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
        state: row.lastHealth && row.lastHealth.state ? row.lastHealth.state : null,
        domainClass: row.domainClass || 'unknown',
        schoolType: row.schoolType || 'unknown',
        eduScope: row.eduScope || null,
        regionKey: row.regionKey || null,
        tags: Array.isArray(row.tags) ? row.tags : []
      }
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError('admin.os_link_registry.lookup', err, { traceId, requestId, actor, linkId });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleLookup
};
