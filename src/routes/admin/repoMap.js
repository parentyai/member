'use strict';

const fs = require('fs');
const path = require('path');

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');

const REPO_MAP_PATH = path.resolve(__dirname, '..', '..', '..', 'docs', 'REPO_AUDIT_INPUTS', 'repo_map_ui.json');
const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.repo_map';

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleRepoMap(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  try {
    if (!fs.existsSync(REPO_MAP_PATH)) {
      writeJson(
        res,
        503,
        { ok: false, error: 'repo_map_not_generated', traceId, requestId },
        { state: 'blocked', reason: 'repo_map_not_generated' }
      );
      return;
    }
    const text = fs.readFileSync(REPO_MAP_PATH, 'utf8');
    const payload = JSON.parse(text);

    try {
      await appendAuditLog({
        actor,
        action: 'repo_map.view',
        entityType: 'repo_map',
        entityId: 'repo_map_ui',
        traceId,
        requestId,
        payloadSummary: {
          generatedAt: payload && payload.meta ? payload.meta.generatedAt || null : null,
          version: payload && payload.meta ? payload.meta.version || null : null
        }
      });
    } catch (auditErr) {
      // Audit write is best-effort for map view; do not block read response.
      logRouteError('admin.repo_map.audit', auditErr, { actor, traceId, requestId });
    }

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      generatedAt: payload.meta && payload.meta.generatedAt ? payload.meta.generatedAt : null,
      layers: payload.layers || null,
      repoMap: payload
    }, { state: 'success', reason: 'completed' });
  } catch (err) {
    logRouteError('admin.repo_map.view', err, { actor, traceId, requestId });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, { state: 'error', reason: 'error' });
  }
}

module.exports = {
  handleRepoMap
};
