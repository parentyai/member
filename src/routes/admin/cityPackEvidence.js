'use strict';

const sourceEvidenceRepo = require('../../repos/firestore/sourceEvidenceRepo');
const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
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
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }

  const actor = resolveActor(req);
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  try {
    const evidence = await sourceEvidenceRepo.getEvidence(evidenceId);
    if (!evidence) {
      writeJson(res, 404, { ok: false, error: 'source evidence not found' });
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
      evidence,
      previousEvidence: previous,
      sourceRef,
      impactedCityPacks
    });
  } catch (err) {
    logRouteError('admin.city_pack_evidence', err, { actor, traceId, requestId });
    writeJson(res, 500, { ok: false, error: err && err.message ? err.message : 'error' });
  }
}

module.exports = {
  handleCityPackEvidence
};
