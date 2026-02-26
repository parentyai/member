'use strict';

const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const sourceEvidenceRepo = require('../../repos/firestore/sourceEvidenceRepo');
const sourceAuditRunsRepo = require('../../repos/firestore/sourceAuditRunsRepo');
const cityPackMetricsDailyRepo = require('../../repos/firestore/cityPackMetricsDailyRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { reviewSourceRefDecision } = require('../../usecases/cityPack/reviewSourceRefDecision');
const { runCityPackSourceAuditJob } = require('../../usecases/cityPack/runCityPackSourceAuditJob');
const { computeCityPackMetrics, normalizeWindowDays, normalizeLimit: normalizeMetricsLimit } = require('../../usecases/cityPack/computeCityPackMetrics');
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

function normalizeEvidenceLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 50;
  return Math.min(Math.floor(num), 200);
}

function normalizePackClassFilter(value) {
  const packClass = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!packClass) return null;
  return packClass === 'nationwide' ? 'nationwide' : packClass === 'regional' ? 'regional' : null;
}

function normalizeLanguageFilter(value) {
  const language = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return language || null;
}

function normalizeSchoolTypeFilter(value) {
  const schoolType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!schoolType) return null;
  if (schoolType === 'public' || schoolType === 'private' || schoolType === 'unknown') return schoolType;
  return null;
}

function normalizeEduScopeFilter(value) {
  const eduScope = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!eduScope) return null;
  if (eduScope === 'calendar' || eduScope === 'district_info' || eduScope === 'enrollment' || eduScope === 'closure_alert') {
    return eduScope;
  }
  return null;
}

function normalizeRegionKeyFilter(value) {
  const regionKey = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return regionKey || null;
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

function parseRunPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-source-audit\/runs\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

function parsePolicyPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/source-refs\/([^/]+)\/policy$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
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

function resolveAuditStage(sourceRef) {
  const stage = sourceRef && typeof sourceRef.lastAuditStage === 'string' ? sourceRef.lastAuditStage.trim().toLowerCase() : '';
  return stage === 'light' || stage === 'heavy' ? stage : '-';
}

function resolveConfidenceScore(sourceRef) {
  const value = Number(sourceRef && sourceRef.confidenceScore);
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

async function ensureCityPackWriteAllowed(res, context, entityType, entityId) {
  const killSwitch = await getKillSwitch();
  if (!killSwitch) return true;
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.write.blocked',
    entityType: entityType || 'source_ref',
    entityId: entityId || 'unknown',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      reason: 'kill_switch_on',
      regionKey: null
    }
  });
  writeJson(res, 409, { ok: false, error: 'kill switch on', traceId: context.traceId });
  return false;
}

function computePriorityScore(sourceRef, nowMs) {
  const status = sourceRef && sourceRef.status ? String(sourceRef.status) : '';
  const validUntilMs = toMillis(sourceRef && sourceRef.validUntil);
  const requiredLevel = sourceRef && typeof sourceRef.requiredLevel === 'string' ? sourceRef.requiredLevel.trim().toLowerCase() : 'required';
  const riskLevel = sourceRef && typeof sourceRef.riskLevel === 'string' ? sourceRef.riskLevel.trim().toLowerCase() : '';
  const confidenceScore = resolveConfidenceScore(sourceRef);

  let score = 0;
  if (!validUntilMs || validUntilMs <= nowMs) score += 70;
  const nearExpiryMs = nowMs + (14 * 24 * 60 * 60 * 1000);
  if (validUntilMs > nowMs && validUntilMs <= nearExpiryMs) score += 25;
  if (status === 'dead') score += 60;
  if (status === 'blocked') score += 55;
  if (status === 'needs_review') score += 40;
  if (requiredLevel === 'required') score += 10;
  if (riskLevel === 'high') score += 12;
  if (riskLevel === 'medium') score += 6;
  if (confidenceScore == null) score += 15;
  else score += Math.round((100 - confidenceScore) / 5);
  return Math.max(0, score);
}

function resolvePriorityLevel(score) {
  if (score >= 90) return 'HIGH';
  if (score >= 45) return 'MEDIUM';
  return 'LOW';
}

async function resolveUsedByDetails(sourceRef) {
  const ids = Array.isArray(sourceRef && sourceRef.usedByCityPackIds) ? sourceRef.usedByCityPackIds : [];
  if (!ids.length) return [];
  const details = [];
  for (const cityPackId of ids) {
    const cityPack = await cityPacksRepo.getCityPack(cityPackId);
    if (!cityPack) continue;
    details.push({
      cityPackId,
      name: cityPack.name || cityPack.id,
      packClass: cityPack.packClass || 'regional',
      language: cityPack.language || 'ja'
    });
  }
  return details;
}

async function handleReviewInbox(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const status = (url.searchParams.get('status') || '').trim() || null;
  const packClass = normalizePackClassFilter(url.searchParams.get('packClass'));
  const language = normalizeLanguageFilter(url.searchParams.get('language'));
  const schoolType = normalizeSchoolTypeFilter(url.searchParams.get('schoolType'));
  const eduScope = normalizeEduScopeFilter(url.searchParams.get('eduScope'));
  const regionKey = normalizeRegionKeyFilter(url.searchParams.get('regionKey'));
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const nowMs = Date.now();

  const expandedLimit = (packClass || language) ? Math.min(limit * 5, 1000) : limit;
  const refs = await sourceRefsRepo.listSourceRefs({
    status,
    limit: expandedLimit,
    schoolType,
    eduScope,
    regionKey
  });
  const items = [];
  for (const sourceRef of refs) {
    const usedByDetails = await resolveUsedByDetails(sourceRef);
    const latestEvidence = sourceRef && sourceRef.evidenceLatestId
      ? await sourceEvidenceRepo.getEvidence(sourceRef.evidenceLatestId)
      : null;
    const diffSummary = latestEvidence && typeof latestEvidence.diffSummary === 'string' && latestEvidence.diffSummary.trim()
      ? latestEvidence.diffSummary.trim()
      : null;
    const packClassMatches = !packClass || usedByDetails.some((item) => item.packClass === packClass);
    const languageMatches = !language || usedByDetails.some((item) => item.language === language);
    if (!packClassMatches || !languageMatches) continue;
    const usedBy = usedByDetails.map((item) => item.name);
    const usedByPackClasses = Array.from(new Set(usedByDetails.map((item) => item.packClass)));
    const usedByLanguages = Array.from(new Set(usedByDetails.map((item) => item.language)));
    const priorityScore = computePriorityScore(sourceRef, nowMs);
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
      diffSummary,
      riskLevel: sourceRef.riskLevel || null,
      sourceType: sourceRef.sourceType || 'other',
      requiredLevel: sourceRef.requiredLevel || 'required',
      authorityLevel: sourceRef.authorityLevel || 'other',
      domainClass: sourceRef.domainClass || 'unknown',
      schoolType: sourceRef.schoolType || 'unknown',
      eduScope: sourceRef.eduScope || null,
      regionKey: sourceRef.regionKey || null,
      confidenceScore: resolveConfidenceScore(sourceRef),
      lastAuditStage: resolveAuditStage(sourceRef),
      usedByPackClasses,
      usedByLanguages,
      priorityScore,
      priorityLevel: resolvePriorityLevel(priorityScore),
      traceId: context.traceId
    });
  }
  items.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return toMillis(b.validUntil) - toMillis(a.validUntil);
  });
  const limitedItems = items.slice(0, limit);

  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.review_inbox.view',
    entityType: 'city_pack',
    entityId: 'review_inbox',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status,
      packClass: packClass || null,
      language: language || null,
      schoolType: schoolType || null,
      eduScope: eduScope || null,
      regionKey: regionKey || null,
      count: limitedItems.length
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    items: limitedItems
  });
}

async function handleSourceRefDecision(req, res, bodyText, context, sourceRefId, decision) {
  const writeAllowed = await ensureCityPackWriteAllowed(res, context, 'source_ref', sourceRefId);
  if (!writeAllowed) return;
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

async function handleSourceRefPolicy(req, res, bodyText, context, sourceRefId) {
  const writeAllowed = await ensureCityPackWriteAllowed(res, context, 'source_ref', sourceRefId);
  if (!writeAllowed) return;
  const sourceRef = await sourceRefsRepo.getSourceRef(sourceRefId);
  if (!sourceRef) {
    writeJson(res, 404, { ok: false, error: 'source ref not found' });
    return;
  }
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const policyPatch = sourceRefsRepo.normalizeSourcePolicyPatch(payload);
  const nextAuthorityLevel = Object.prototype.hasOwnProperty.call(policyPatch, 'authorityLevel')
    ? policyPatch.authorityLevel
    : (sourceRef.authorityLevel || 'other');
  await sourceRefsRepo.updateSourceRef(sourceRefId, policyPatch);
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.source_policy.update',
    entityType: 'source_ref',
    entityId: sourceRefId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      sourceType: policyPatch.sourceType,
      requiredLevel: policyPatch.requiredLevel,
      authorityLevel: nextAuthorityLevel
    }
  });
  writeJson(res, 200, {
    ok: true,
    sourceRefId,
    traceId: context.traceId,
    sourceType: policyPatch.sourceType,
    requiredLevel: policyPatch.requiredLevel,
    authorityLevel: nextAuthorityLevel
  });
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

async function handleCityPackMetrics(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const windowDays = normalizeWindowDays(url.searchParams.get('windowDays'));
  const limit = normalizeMetricsLimit(url.searchParams.get('limit'));
  const metrics = await computeCityPackMetrics({
    windowDays,
    limit,
    traceId: context.traceId
  });
  if (Array.isArray(metrics.dailyRows) && metrics.dailyRows.length) {
    await cityPackMetricsDailyRepo.upsertMetricRows(metrics.dailyRows);
  }

  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.metrics.view',
    entityType: 'city_pack',
    entityId: 'metrics',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      windowDays,
      rowCount: Array.isArray(metrics.items) ? metrics.items.length : 0,
      totalSent: metrics.summary && Number(metrics.summary.totalSent) || 0
    }
  });

  writeJson(res, 200, metrics);
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
      stage: run.stage || 'heavy',
      startedAt: run.startedAt || null,
      endedAt: run.endedAt || null,
      processed: Number(run.processed) || 0,
      succeeded: Number(run.succeeded) || 0,
      failed: Number(run.failed) || 0,
      failureTop3: Array.isArray(run.failureTop3) ? run.failureTop3 : [],
      confidenceSummary: run.confidenceSummary || null,
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

async function handleCityPackAuditRunDetail(req, res, context, runId) {
  const url = new URL(req.url, 'http://localhost');
  const evidenceLimit = normalizeEvidenceLimit(url.searchParams.get('limit'));
  const run = await sourceAuditRunsRepo.getRun(runId);
  if (!run) {
    writeJson(res, 404, { ok: false, error: 'source audit run not found' });
    return;
  }

  const traceIdForEvidence = typeof run.traceId === 'string' && run.traceId.trim() ? run.traceId.trim() : null;
  const evidences = traceIdForEvidence
    ? await sourceEvidenceRepo.listEvidenceByTraceId(traceIdForEvidence, evidenceLimit)
    : [];

  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.source_audit.run.view',
    entityType: 'source_audit_run',
    entityId: runId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      runId,
      evidenceCount: evidences.length,
      evidenceLimit
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    run: {
      runId: run.runId || run.id,
      mode: run.mode || 'scheduled',
      stage: run.stage || 'heavy',
      startedAt: run.startedAt || null,
      endedAt: run.endedAt || null,
      processed: Number(run.processed) || 0,
      succeeded: Number(run.succeeded) || 0,
      failed: Number(run.failed) || 0,
      failureTop3: Array.isArray(run.failureTop3) ? run.failureTop3 : [],
      confidenceSummary: run.confidenceSummary || null,
      status: mapRunStatus(run),
      sourceTraceId: traceIdForEvidence
    },
    evidenceLimit,
    evidences: evidences.map((item) => ({
      evidenceId: item.id,
      sourceRefId: item.sourceRefId || null,
      result: item.result || null,
      statusCode: item.statusCode || null,
      finalUrl: item.finalUrl || null,
      checkedAt: item.checkedAt || null
    }))
  });
}

async function handleCityPackAuditRun(req, res, bodyText, context) {
  const writeAllowed = await ensureCityPackWriteAllowed(res, context, 'source_audit_run', 'manual');
  if (!writeAllowed) return;
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const stage = typeof payload.stage === 'string' ? payload.stage : null;
  const result = await runCityPackSourceAuditJob({
    runId: payload.runId,
    mode: payload.mode,
    stage,
    packClass: normalizePackClassFilter(payload.packClass),
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

    if (req.method === 'GET' && pathname === '/api/admin/city-pack-metrics') {
      await handleCityPackMetrics(req, res, context);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/city-pack-source-audit/runs') {
      await handleCityPackAuditRuns(req, res, context);
      return;
    }

    if (req.method === 'GET') {
      const runId = parseRunPath(pathname);
      if (runId) {
        await handleCityPackAuditRunDetail(req, res, context, runId);
        return;
      }
    }

    if (req.method === 'POST' && pathname === '/api/admin/city-pack-source-audit/run') {
      await handleCityPackAuditRun(req, res, bodyText, context);
      return;
    }

    if (req.method === 'POST') {
      const sourceRefId = parsePolicyPath(pathname);
      if (sourceRefId) {
        await handleSourceRefPolicy(req, res, bodyText, context, sourceRefId);
        return;
      }
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
