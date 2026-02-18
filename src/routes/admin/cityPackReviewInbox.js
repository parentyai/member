'use strict';

const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const sourceEvidenceRepo = require('../../repos/firestore/sourceEvidenceRepo');
const sourceAuditRunsRepo = require('../../repos/firestore/sourceAuditRunsRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { reviewSourceRefDecision } = require('../../usecases/cityPack/reviewSourceRefDecision');
const { runCityPackSourceAuditJob } = require('../../usecases/cityPack/runCityPackSourceAuditJob');
const { resolveActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 50;
  return Math.min(Math.floor(num), 300);
}

function normalizeRunLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 20;
  return Math.min(Math.floor(num), 100);
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function parseActionPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/source-refs\/([^/]+)\/(confirm|retire|replace|manual-only)$/);
  if (!match) return null;
  return {
    sourceRefId: decodeURIComponent(match[1]),
    decision: match[2]
  };
}

function resolveResultLabel(sourceRef) {
  const result = sourceRef && sourceRef.lastResult ? String(sourceRef.lastResult) : '';
  if (result === 'ok') return '正常';
  if (result === 'redirect') return 'リダイレクト';
  if (result === 'http_error') return 'HTTPエラー';
  if (result === 'timeout') return 'タイムアウト';
  if (result === 'diff_detected') return '差分検出';
  if (result === 'error') return '監査失敗';
  return '-';
}

function resolveRecommendation(sourceRef, nowMs) {
  const status = sourceRef && sourceRef.status ? String(sourceRef.status) : '';
  const validUntilMs = toMillis(sourceRef && sourceRef.validUntil);
  if (!validUntilMs || validUntilMs <= nowMs) return 'Confirm';
  if (status === 'dead') return 'Retire';
  if (status === 'needs_review') return 'Confirm';
  if (status === 'blocked') return 'Replace';
  return 'ManualOnly';
}

async function resolveUsedByNames(sourceRef) {
  const ids = Array.isArray(sourceRef && sourceRef.usedByCityPackIds) ? sourceRef.usedByCityPackIds : [];
  if (!ids.length) return [];
  const names = [];
  for (const cityPackId of ids) {
    const cityPack = await cityPacksRepo.getCityPack(cityPackId);
    if (!cityPack) continue;
    names.push(cityPack.name || cityPack.id);
  }
  return names;
}

async function handleReviewInbox(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const status = (url.searchParams.get('status') || '').trim() || null;
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const nowMs = Date.now();

  const refs = await sourceRefsRepo.listSourceRefs({ status, limit });
  const items = [];
  for (const sourceRef of refs) {
    const usedBy = await resolveUsedByNames(sourceRef);
    items.push({
      sourceRefId: sourceRef.id,
      source: sourceRef.url,
      status: sourceRef.status || null,
      result: resolveResultLabel(sourceRef),
      validUntil: sourceRef.validUntil || null,
      usedBy,
      usedByCount: usedBy.length,
      evidenceLatestId: sourceRef.evidenceLatestId || null,
      recommendation: resolveRecommendation(sourceRef, nowMs),
      riskLevel: sourceRef.riskLevel || null,
      traceId: context.traceId
    });
  }

  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.review_inbox.view',
    entityType: 'city_pack',
    entityId: 'review_inbox',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status,
      count: items.length
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    items
  });
}

async function handleSourceRefDecision(req, res, bodyText, context, sourceRefId, decision) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const result = await reviewSourceRefDecision({
    sourceRefId,
    decision,
    replacementUrl: payload.replacementUrl,
    actor: context.actor,
    traceId: context.traceId,
    requestId: context.requestId
  });
  if (!result.ok) {
    writeJson(res, 409, result);
    return;
  }
  writeJson(res, 200, result);
}

async function handleCityPackKpi(req, res, context) {
  const refs = await sourceRefsRepo.listSourceRefs({ limit: 1000 });
  const nowMs = Date.now();

  const total = refs.length;
  let expired = 0;
  let dead = 0;
  let blocked = 0;
  let needsReview = 0;
  const reviewLagSamples = [];

  refs.forEach((ref) => {
    const status = ref && ref.status ? String(ref.status) : '';
    const validUntilMs = toMillis(ref && ref.validUntil);
    if (!validUntilMs || validUntilMs <= nowMs) expired += 1;
    if (status === 'dead') dead += 1;
    if (status === 'blocked' || status === 'retired') blocked += 1;
    if (status === 'needs_review') {
      needsReview += 1;
      const checkedMs = toMillis(ref && ref.lastCheckAt);
      if (checkedMs > 0 && checkedMs <= nowMs) reviewLagSamples.push(nowMs - checkedMs);
    }
  });

  const expiredZeroRate = total > 0 ? (total - expired) / total : 1;
  const deadDetectionRate = total > 0 ? dead / total : 0;
  const sourceBlockedRate = total > 0 ? (expired + dead + blocked) / total : 0;
  const reviewLagHours = reviewLagSamples.length
    ? Math.round((reviewLagSamples.reduce((sum, value) => sum + value, 0) / reviewLagSamples.length) / (60 * 60 * 1000) * 10) / 10
    : 0;

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    metrics: {
      expiredSourceZeroRate: expiredZeroRate,
      reviewBacklog: needsReview,
      reviewLagHours,
      deadDetectionRate,
      sourceBlockedRate,
      totals: {
        total,
        expired,
        dead,
        blocked,
        needsReview
      }
    }
  });
}

function mapRunStatus(run) {
  if (!run || !run.endedAt) return 'RUNNING';
  if (Number(run.failed) > 0) return 'WARN';
  return 'OK';
}

async function handleCityPackAuditRuns(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const limit = normalizeRunLimit(url.searchParams.get('limit'));
  const runs = await sourceAuditRunsRepo.listRuns(limit);

  const items = runs.map((run) => {
    const status = mapRunStatus(run);
    return {
      runId: run.runId || run.id,
      mode: run.mode || 'scheduled',
      startedAt: run.startedAt || null,
      endedAt: run.endedAt || null,
      processed: Number(run.processed) || 0,
      succeeded: Number(run.succeeded) || 0,
      failed: Number(run.failed) || 0,
      failureTop3: Array.isArray(run.failureTop3) ? run.failureTop3 : [],
      traceId: run.traceId || null,
      status
    };
  });

  const summary = {
    total: items.length,
    running: items.filter((item) => item.status === 'RUNNING').length,
    ok: items.filter((item) => item.status === 'OK').length,
    warn: items.filter((item) => item.status === 'WARN').length
  };

  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.source_audit.runs.view',
    entityType: 'source_audit_run',
    entityId: 'list',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      count: items.length,
      limit
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    summary,
    items
  });
}

async function handleCityPackAuditRun(req, res, bodyText, context) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const result = await runCityPackSourceAuditJob({
    runId: payload.runId,
    mode: payload.mode,
    targetSourceRefIds: payload.targetSourceRefIds,
    traceId: context.traceId,
    actor: context.actor,
    requestId: context.requestId
  });
  writeJson(res, 200, result);
}

async function handleCityPackReviewInbox(req, res, bodyText) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };

  try {
    if (req.method === 'GET' && pathname === '/api/admin/review-inbox') {
      await handleReviewInbox(req, res, context);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/city-pack-kpi') {
      await handleCityPackKpi(req, res, context);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/city-pack-source-audit/runs') {
      await handleCityPackAuditRuns(req, res, context);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/city-pack-source-audit/run') {
      await handleCityPackAuditRun(req, res, bodyText, context);
      return;
    }

    if (req.method === 'POST') {
      const parsed = parseActionPath(pathname);
      if (parsed) {
        await handleSourceRefDecision(req, res, bodyText, context, parsed.sourceRefId, parsed.decision);
        return;
      }
    }

    writeJson(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    logRouteError('admin.city_pack_review_inbox', err, context);
    writeJson(res, 500, { ok: false, error: err && err.message ? err.message : 'error' });
  }
}

module.exports = {
  handleCityPackReviewInbox
};
