'use strict';

const crypto = require('crypto');

const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const journeyGraphCatalogRepo = require('../../repos/firestore/journeyGraphCatalogRepo');
const journeyGraphChangeLogsRepo = require('../../repos/firestore/journeyGraphChangeLogsRepo');
const { parseJson, requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

function serializeCatalog(catalog) {
  const payload = catalog && typeof catalog === 'object' ? catalog : {};
  return JSON.stringify({
    enabled: payload.enabled === true,
    schemaVersion: payload.schemaVersion,
    nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
    edges: Array.isArray(payload.edges) ? payload.edges : [],
    ruleSet: payload.ruleSet && typeof payload.ruleSet === 'object' ? payload.ruleSet : {},
    planUnlocks: payload.planUnlocks && typeof payload.planUnlocks === 'object' ? payload.planUnlocks : {}
  });
}

function computePlanHash(catalog) {
  const text = `journeyGraphCatalog=${serializeCatalog(catalog)}`;
  return `journeygraph_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

function confirmTokenData(planHash) {
  return {
    planHash,
    templateKey: 'journey_graph_catalog',
    templateVersion: '',
    segmentKey: 'opsConfig'
  };
}

function resolveFeatureFlags() {
  const parseFlag = (name, defaultValue) => {
    const raw = process.env[name];
    if (typeof raw !== 'string') return defaultValue;
    const normalized = raw.trim().toLowerCase();
    if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
    if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
    return defaultValue;
  };
  return {
    dagCatalogEnabled: parseFlag('ENABLE_JOURNEY_DAG_CATALOG_V1', false),
    dagUiEnabled: parseFlag('ENABLE_JOURNEY_DAG_UI_V1', false),
    ruleEngineEnabled: parseFlag('ENABLE_JOURNEY_RULE_ENGINE_V1', false)
  };
}

function parseLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('limit') || 20);
  if (!Number.isFinite(raw) || raw < 1) return 20;
  return Math.min(Math.floor(raw), 100);
}

function mergeCatalog(base, patch) {
  const baseline = base && typeof base === 'object' ? base : {};
  const payload = patch && typeof patch === 'object' ? patch : {};
  return Object.assign({}, baseline, payload);
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const journeyGraphCatalog = await journeyGraphCatalogRepo.getJourneyGraphCatalog();
  const flags = resolveFeatureFlags();
  const effectiveEnabled = Boolean(
    journeyGraphCatalog.enabled
    && flags.dagCatalogEnabled
    && flags.dagUiEnabled
    && flags.ruleEngineEnabled
  );

  await appendAuditLog({
    actor,
    action: 'journey_graph.status.view',
    entityType: 'opsConfig',
    entityId: 'journeyGraphCatalog',
    traceId,
    requestId,
    payloadSummary: {
      effectiveEnabled,
      flags,
      nodeCount: Array.isArray(journeyGraphCatalog.nodes) ? journeyGraphCatalog.nodes.length : 0,
      edgeCount: Array.isArray(journeyGraphCatalog.edges) ? journeyGraphCatalog.edges.length : 0
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    journeyGraphCatalog,
    flags,
    effectiveEnabled,
    serverTime: new Date().toISOString()
  }));
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const base = await journeyGraphCatalogRepo.getJourneyGraphCatalog();
  const candidate = payload.catalog === undefined ? base : mergeCatalog(base, payload.catalog);
  const normalized = journeyGraphCatalogRepo.normalizeJourneyGraphCatalog(candidate);
  if (!normalized) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid journeyGraphCatalog', traceId, requestId }));
    return;
  }

  const planHash = computePlanHash(normalized);
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });

  await appendAuditLog({
    actor,
    action: 'journey_graph.plan',
    entityType: 'opsConfig',
    entityId: 'journeyGraphCatalog',
    traceId,
    requestId,
    payloadSummary: {
      planHash,
      nodeCount: normalized.nodes.length,
      edgeCount: normalized.edges.length,
      enabled: normalized.enabled
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    journeyGraphCatalog: normalized,
    planHash,
    confirmToken,
    serverTime: new Date().toISOString()
  }));
}

async function handleSet(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const base = await journeyGraphCatalogRepo.getJourneyGraphCatalog();
  const candidate = payload.catalog === undefined ? base : mergeCatalog(base, payload.catalog);
  const normalized = journeyGraphCatalogRepo.normalizeJourneyGraphCatalog(candidate);
  if (!normalized) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid journeyGraphCatalog', traceId, requestId }));
    return;
  }

  const planHash = typeof payload.planHash === 'string' ? payload.planHash.trim() : '';
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken.trim() : '';
  if (!planHash || !confirmToken) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'planHash/confirmToken required', traceId, requestId }));
    return;
  }

  const expectedPlanHash = computePlanHash(normalized);
  if (expectedPlanHash !== planHash) {
    await appendAuditLog({
      actor,
      action: 'journey_graph.set',
      entityType: 'opsConfig',
      entityId: 'journeyGraphCatalog',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'plan_hash_mismatch',
        expectedPlanHash,
        planHash
      }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId, requestId }));
    return;
  }

  const tokenValid = verifyConfirmToken(confirmToken, confirmTokenData(planHash), { now: new Date() });
  if (!tokenValid) {
    await appendAuditLog({
      actor,
      action: 'journey_graph.set',
      entityType: 'opsConfig',
      entityId: 'journeyGraphCatalog',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'confirm_token_mismatch'
      }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'confirm_token_mismatch', traceId, requestId }));
    return;
  }

  const saved = await journeyGraphCatalogRepo.setJourneyGraphCatalog(normalized, actor);
  await journeyGraphChangeLogsRepo.appendJourneyGraphChangeLog({
    actor,
    traceId,
    requestId,
    planHash,
    catalog: saved,
    summary: {
      enabled: saved.enabled === true,
      schemaVersion: saved.schemaVersion,
      nodeCount: Array.isArray(saved.nodes) ? saved.nodes.length : 0,
      edgeCount: Array.isArray(saved.edges) ? saved.edges.length : 0
    },
    createdAt: new Date().toISOString()
  }).catch(() => null);
  await appendAuditLog({
    actor,
    action: 'journey_graph.set',
    entityType: 'opsConfig',
    entityId: 'journeyGraphCatalog',
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      enabled: saved.enabled === true,
      nodeCount: Array.isArray(saved.nodes) ? saved.nodes.length : 0,
      edgeCount: Array.isArray(saved.edges) ? saved.edges.length : 0
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    journeyGraphCatalog: saved,
    serverTime: new Date().toISOString()
  }));
}

async function handleHistory(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);

  const items = await journeyGraphChangeLogsRepo.listJourneyGraphChangeLogs(limit).catch(() => []);
  await appendAuditLog({
    actor,
    action: 'journey_graph.history.view',
    entityType: 'opsConfig',
    entityId: 'journeyGraphCatalog',
    traceId,
    requestId,
    payloadSummary: {
      limit,
      count: items.length
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    limit,
    items
  }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet,
  handleHistory
};
