'use strict';

const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const sourceEvidenceRepo = require('../../repos/firestore/sourceEvidenceRepo');
const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.city_pack_evidence';

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

function parseEvidenceId(pathname) {
  const match = pathname.match(/^\/api\/admin\/source-evidence\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

async function handleCityPackEvidence(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const evidenceId = parseEvidenceId(pathname);
  if (!evidenceId || req.method !== 'GET') {
    writeJson(res, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found'
    });
    return;
  }

  const actor = resolveActor(req);
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  try {
    const evidence = await sourceEvidenceRepo.getEvidence(evidenceId);
    if (!evidence) {
      writeJson(res, 404, {
        ok: false,
        error: 'source evidence not found',
        traceId,
        requestId
      }, {
        state: 'error',
        reason: 'source_evidence_not_found'
      });
      return;
    }

    const sourceRef = evidence.sourceRefId ? await sourceRefsRepo.getSourceRef(evidence.sourceRefId) : null;
    const previousList = evidence.sourceRefId ? await sourceEvidenceRepo.listEvidenceBySourceRef(evidence.sourceRefId, 2) : [];
    const previous = previousList.find((item) => item.id !== evidence.id) || null;

    const impactedCityPacks = [];
    const usedBy = Array.isArray(sourceRef && sourceRef.usedByCityPackIds) ? sourceRef.usedByCityPackIds : [];
    for (const cityPackId of usedBy) {
      const cityPack = await cityPacksRepo.getCityPack(cityPackId);
      if (!cityPack) continue;
      impactedCityPacks.push({ cityPackId, name: cityPack.name || cityPack.id, status: cityPack.status || null });
    }

    await appendAuditLog({
      actor,
      action: 'city_pack.evidence.view',
      entityType: 'source_evidence',
      entityId: evidenceId,
      traceId,
      requestId,
      payloadSummary: {
        sourceRefId: evidence.sourceRefId || null,
        impactedCityPackCount: impactedCityPacks.length
      }
    });

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      evidence,
      previousEvidence: previous,
      sourceRef,
      impactedCityPacks
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError(ROUTE_KEY, err, { actor, traceId, requestId });
    writeJson(res, 500, {
      ok: false,
      error: err && err.message ? err.message : 'error',
      traceId,
      requestId
    }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleCityPackEvidence
};
