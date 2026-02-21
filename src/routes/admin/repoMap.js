'use strict';

const fs = require('fs');
const path = require('path');

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');

const REPO_MAP_PATH = path.resolve(__dirname, '..', '..', '..', 'docs', 'REPO_AUDIT_INPUTS', 'repo_map_ui.json');

async function handleRepoMap(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  try {
    if (!fs.existsSync(REPO_MAP_PATH)) {
      res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'repo_map_not_generated', traceId, requestId }));
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

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      generatedAt: payload.meta && payload.meta.generatedAt ? payload.meta.generatedAt : null,
      layers: payload.layers || null,
      repoMap: payload
    }));
  } catch (err) {
    logRouteError('admin.repo_map.view', err, { actor, traceId, requestId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleRepoMap
};
