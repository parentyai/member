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

const SURFACE_PATH = path.resolve(__dirname, '..', '..', '..', 'docs', 'REPO_AUDIT_INPUTS', 'missing_index_surface.json');
const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.missing_index_surface';

function parseLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('limit'));
  if (!Number.isFinite(raw) || raw <= 0) return 50;
  return Math.min(Math.floor(raw), 200);
}

function parseFileContains(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = url.searchParams.get('fileContains');
  if (!raw || !raw.trim()) return null;
  return raw.trim().toLowerCase();
}

function loadSurfacePayload() {
  if (!fs.existsSync(SURFACE_PATH)) {
    return {
      generatedAt: null,
      surface_count: 0,
      point_count: 0,
      call_breakdown: {},
      items: []
    };
  }
  const raw = fs.readFileSync(SURFACE_PATH, 'utf8');
  const payload = JSON.parse(raw);
  return {
    generatedAt: payload && payload.generatedAt ? payload.generatedAt : null,
    sourceDigest: payload && payload.sourceDigest ? payload.sourceDigest : null,
    surface_count: Number.isFinite(Number(payload && payload.surface_count)) ? Number(payload.surface_count) : 0,
    point_count: Number.isFinite(Number(payload && payload.point_count)) ? Number(payload.point_count) : 0,
    call_breakdown: payload && typeof payload.call_breakdown === 'object' && payload.call_breakdown ? payload.call_breakdown : {},
    items: Array.isArray(payload && payload.items) ? payload.items : []
  };
}

function normalizeRow(row) {
  return {
    file: row && row.file ? String(row.file) : null,
    call: row && row.call ? String(row.call) : null,
    lines: Array.isArray(row && row.lines)
      ? row.lines.filter((line) => Number.isFinite(Number(line))).map((line) => Number(line)).sort((a, b) => a - b)
      : [],
    occurrences: Number.isFinite(Number(row && row.occurrences)) ? Number(row.occurrences) : 0,
    policy: row && typeof row.policy === 'object' && row.policy ? row.policy : {}
  };
}

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

async function handleMissingIndexSurface(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);
  const fileContains = parseFileContains(req);

  try {
    const payload = loadSurfacePayload();
    const filtered = payload.items
      .map(normalizeRow)
      .filter((row) => {
        if (!fileContains) return true;
        return String(row && row.file ? row.file : '').toLowerCase().includes(fileContains);
      });
    const items = filtered.slice(0, limit);

    try {
      await appendAuditLog({
        actor,
        action: 'missing_index.surface.view',
        entityType: 'read_path',
        entityId: 'missing_index_surface',
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        payloadSummary: {
          limit,
          fileContains,
          total: filtered.length,
          returned: items.length,
          generatedAt: payload.generatedAt || null
        }
      });
    } catch (auditErr) {
      logRouteError('admin.missing_index_surface.audit', auditErr, { actor, traceId, requestId });
    }

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      generatedAt: payload.generatedAt,
      sourceDigest: payload.sourceDigest || null,
      surfaceCount: payload.surface_count,
      pointCount: payload.point_count,
      limit,
      fileContains,
      callBreakdown: payload.call_breakdown,
      items
    }, { state: 'success', reason: 'completed' });
  } catch (err) {
    logRouteError('admin.missing_index_surface.view', err, { actor, traceId, requestId });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, { state: 'error', reason: 'error' });
  }
}

module.exports = {
  handleMissingIndexSurface
};
