'use strict';

const { URL } = require('url');

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { queryLatestPatrolInsights } = require('../../usecases/qualityPatrol/queryLatestPatrolInsights');
const { queryLatestDesktopPatrolSummary } = require('../../usecases/qualityPatrol/queryLatestDesktopPatrolSummary');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.quality_patrol';

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

function parsePositiveInt(value, fallback, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(numeric)));
}

function parseQueryParams(req) {
  const url = new URL(req.url || '/api/admin/quality-patrol', 'http://127.0.0.1');
  const limit = parsePositiveInt(url.searchParams.get('limit'), 100, 500);
  return {
    mode: url.searchParams.get('mode') || 'latest',
    audience: url.searchParams.get('audience') || 'operator',
    fromAt: url.searchParams.get('fromAt') || null,
    toAt: url.searchParams.get('toAt') || null,
    limit,
    traceLimit: parsePositiveInt(url.searchParams.get('traceLimit'), Math.min(limit, 200), 200),
    registryLimit: parsePositiveInt(url.searchParams.get('registryLimit'), 100, 200),
    backlogLimit: parsePositiveInt(url.searchParams.get('backlogLimit'), 50, 100)
  };
}

async function handleQualityPatrolQuery(req, res, deps) {
  if (req.method !== 'GET') {
    writeJson(res, 404, { ok: false, error: 'not found' }, { reason: 'not_found' });
    return;
  }

  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const queryUsecase = deps && deps.queryLatestPatrolInsights ? deps.queryLatestPatrolInsights : queryLatestPatrolInsights;
  const queryDesktopUsecase = deps && deps.queryLatestDesktopPatrolSummary
    ? deps.queryLatestDesktopPatrolSummary
    : queryLatestDesktopPatrolSummary;
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;

  try {
    const queryParams = parseQueryParams(req);
    const [result, desktopPatrolSummary] = await Promise.all([
      queryUsecase(queryParams, deps),
      queryDesktopUsecase({ audience: queryParams.audience }, deps)
    ]);
    try {
      await auditFn({
        actor,
        action: 'quality_patrol.query.view',
        entityType: 'quality_patrol_query',
        entityId: result && result.mode ? result.mode : 'latest',
        traceId,
        requestId,
        payloadSummary: {
          audience: result && result.audience ? result.audience : 'operator',
          overallStatus: result && result.summary ? result.summary.overallStatus : null,
          topPriorityCount: result && result.summary ? result.summary.topPriorityCount : 0,
          observationBlockerCount: result && result.summary ? result.summary.observationBlockerCount : 0,
          desktopPatrolStatus: desktopPatrolSummary && desktopPatrolSummary.status ? desktopPatrolSummary.status : 'unavailable',
          desktopPatrolStage: desktopPatrolSummary && desktopPatrolSummary.stage ? desktopPatrolSummary.stage : 'not_observed',
          desktopPatrolQueueCount: desktopPatrolSummary && desktopPatrolSummary.queue
            ? Number(desktopPatrolSummary.queue.totalCount || 0)
            : 0,
          desktopPatrolLatestRunId: desktopPatrolSummary && desktopPatrolSummary.latestRun
            ? desktopPatrolSummary.latestRun.runId || null
            : null,
          desktopPatrolLastRunKind: desktopPatrolSummary && desktopPatrolSummary.latestRun
            ? desktopPatrolSummary.latestRun.lastRunKind || null
            : null,
          desktopPatrolSendStatus: desktopPatrolSummary && desktopPatrolSummary.latestRun
            ? desktopPatrolSummary.latestRun.sendStatus || null
            : null,
          desktopPatrolPromotionProposalId: desktopPatrolSummary && desktopPatrolSummary.promotion
            ? desktopPatrolSummary.promotion.latestProposalId || null
            : null,
          desktopPatrolPromotionKind: desktopPatrolSummary && desktopPatrolSummary.promotion
            ? desktopPatrolSummary.promotion.latestArtifactKind || null
            : null,
          desktopPatrolPromotionStatus: desktopPatrolSummary && desktopPatrolSummary.promotion
            ? desktopPatrolSummary.promotion.latestArtifactStatus || null
            : null,
          desktopPatrolPromotionDraftPrRef: desktopPatrolSummary && desktopPatrolSummary.promotion
            ? desktopPatrolSummary.promotion.latestDraftPrRef || null
            : null,
          desktopPatrolPromotionUpdatedAt: desktopPatrolSummary && desktopPatrolSummary.promotion
            ? desktopPatrolSummary.promotion.updatedAt || null
            : null,
          desktopPatrolPromotionBatchRunId: desktopPatrolSummary && desktopPatrolSummary.promotionBatch
            ? desktopPatrolSummary.promotionBatch.batchRunId || null
            : null,
          desktopPatrolPromotionBatchCompletionStatus: desktopPatrolSummary && desktopPatrolSummary.promotionBatch
            ? desktopPatrolSummary.promotionBatch.completionStatus || null
            : null,
          desktopPatrolPromotionBatchQueuedProposalCount: desktopPatrolSummary && desktopPatrolSummary.promotionBatch
            ? Number(desktopPatrolSummary.promotionBatch.queuedProposalCount || 0)
            : 0,
          desktopPatrolPromotionBatchPatchDraftReadyCount: desktopPatrolSummary && desktopPatrolSummary.promotionBatch
            ? Number(desktopPatrolSummary.promotionBatch.patchDraftReadyCount || 0)
            : 0,
          desktopPatrolPromotionReviewKind: desktopPatrolSummary && desktopPatrolSummary.promotionReview
            ? desktopPatrolSummary.promotionReview.latestReviewArtifactKind || null
            : null,
          desktopPatrolPromotionReviewBranch: desktopPatrolSummary && desktopPatrolSummary.promotionReview
            ? desktopPatrolSummary.promotionReview.branchName || null
            : null,
          desktopPatrolPromotionReviewUpdatedAt: desktopPatrolSummary && desktopPatrolSummary.promotionReview
            ? desktopPatrolSummary.promotionReview.updatedAt || null
            : null,
          desktopPatrolPromotionApprovalStage: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? desktopPatrolSummary.promotionApproval.approvalStage || null
            : null,
          desktopPatrolPromotionApprovalStatus: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? desktopPatrolSummary.promotionApproval.approvalStatus || null
            : null,
          desktopPatrolPromotionApprovalCommandCount: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? Number(desktopPatrolSummary.promotionApproval.validationCommandCount || 0)
            : 0,
          desktopPatrolPromotionApprovalUpdatedAt: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? desktopPatrolSummary.promotionApproval.updatedAt || null
            : null
        }
      });
    } catch (auditErr) {
      logRouteError('admin.quality_patrol.audit', auditErr, { actor, traceId, requestId });
    }

    writeJson(res, 200, Object.assign({
      ok: true,
      traceId,
      requestId
    }, result, {
      desktopPatrolSummary
    }), { reason: 'completed' });
  } catch (err) {
    logRouteError('admin.quality_patrol.query', err, { actor, traceId, requestId });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, { reason: 'error' });
  }
}

module.exports = {
  handleQualityPatrolQuery
};
