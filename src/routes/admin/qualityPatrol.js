'use strict';

const { URL } = require('url');

const { verifyConfirmToken } = require('../../domain/confirmToken');
const { buildPromotionApprovalConfirmTokenData } = require('../../domain/qualityPatrol/desktopApprovalFlow');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { queryLatestPatrolInsights } = require('../../usecases/qualityPatrol/queryLatestPatrolInsights');
const { queryLatestDesktopPatrolSummary } = require('../../usecases/qualityPatrol/queryLatestDesktopPatrolSummary');
const { planDesktopPatrolApprovalAction } = require('../../usecases/qualityPatrol/planDesktopPatrolApprovalAction');
const { executeDesktopPatrolApprovalAction } = require('../../usecases/qualityPatrol/executeDesktopPatrolApprovalAction');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');
const { enforceManagedFlowGuard } = require('./managedFlowGuard');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.quality_patrol';
const APPROVAL_PLAN_ROUTE_KEY = 'admin.quality_patrol.desktop_approval.plan';
const APPROVAL_EXECUTE_ACTION = 'quality_patrol.desktop_approval.execute';
const APPROVAL_PLAN_PATH = '/api/admin/quality-patrol/desktop-approval/plan';
const APPROVAL_EXECUTE_PATH = '/api/admin/quality-patrol/desktop-approval/execute';

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

function parseJsonBody(bodyText, res, routeKey) {
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_err) {
    writeJson(res, 400, { ok: false, error: 'invalid json' }, {
      guard: { routeKey: routeKey || ROUTE_KEY },
      state: 'error',
      reason: 'invalid_json'
    });
    return null;
  }
}

function writeKnownError(res, err, routeKey, traceId, requestId) {
  const statusCode = err && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const code = err && err.code ? String(err.code) : 'error';
  const details = err && err.details && typeof err.details === 'object' ? err.details : {};
  writeJson(res, statusCode, Object.assign({
    ok: false,
    error: code,
    traceId: traceId || null,
    requestId: requestId || null
  }, details), {
    guard: { routeKey: routeKey || ROUTE_KEY },
    state: statusCode >= 500 ? 'error' : (statusCode >= 400 ? 'blocked' : 'success')
  });
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
          desktopPatrolPromotionBatchBlockedCaseCount: desktopPatrolSummary && desktopPatrolSummary.promotionBatch
            ? Array.isArray(desktopPatrolSummary.promotionBatch.blockedCaseIds)
              ? desktopPatrolSummary.promotionBatch.blockedCaseIds.length
              : 0
            : 0,
          desktopPatrolPromotionBatchNextAction: desktopPatrolSummary && desktopPatrolSummary.promotionBatch
            ? desktopPatrolSummary.promotionBatch.nextAction || null
            : null,
          desktopPatrolPromotionBatchUpdatedAt: desktopPatrolSummary && desktopPatrolSummary.promotionBatch
            ? desktopPatrolSummary.promotionBatch.updatedAt || null
            : null,
          desktopPatrolPromotionReviewKind: desktopPatrolSummary && desktopPatrolSummary.promotionReview
            ? desktopPatrolSummary.promotionReview.latestReviewArtifactKind || null
            : null,
          desktopPatrolPromotionReviewProposalId: desktopPatrolSummary && desktopPatrolSummary.promotionReview
            ? desktopPatrolSummary.promotionReview.latestProposalId || null
            : null,
          desktopPatrolPromotionReviewStatus: desktopPatrolSummary && desktopPatrolSummary.promotionReview
            ? desktopPatrolSummary.promotionReview.reviewStatus || null
            : null,
          desktopPatrolPromotionReviewDraftPrRef: desktopPatrolSummary && desktopPatrolSummary.promotionReview
            ? desktopPatrolSummary.promotionReview.latestDraftPrRef || null
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
          desktopPatrolPromotionApprovalEvidenceRequirementCount: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? Number(desktopPatrolSummary.promotionApproval.evidenceRequirementCount || 0)
            : 0,
          desktopPatrolPromotionApprovalExpectedOutputCount: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? Number(desktopPatrolSummary.promotionApproval.expectedOutputCount || 0)
            : 0,
          desktopPatrolPromotionApprovalStopConditionCount: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? Number(desktopPatrolSummary.promotionApproval.stopConditionCount || 0)
            : 0,
          desktopPatrolPromotionApprovalCandidateEditCount: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? Number(desktopPatrolSummary.promotionApproval.candidateEditCount || 0)
            : 0,
          desktopPatrolPromotionApprovalOperatorInstructionCount: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? Number(desktopPatrolSummary.promotionApproval.operatorInstructionCount || 0)
            : 0,
          desktopPatrolPromotionApprovalNextCommand: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? desktopPatrolSummary.promotionApproval.nextCommand || null
            : null,
          desktopPatrolPromotionApprovalNextAction: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? desktopPatrolSummary.promotionApproval.nextAction || null
            : null,
          desktopPatrolPromotionApprovalRemainingCommandCount: desktopPatrolSummary && desktopPatrolSummary.promotionApproval
            ? Number(desktopPatrolSummary.promotionApproval.remainingCommandCount || 0)
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

async function handleQualityPatrolApprovalPlan(req, res, bodyText, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJsonBody(bodyText, res, APPROVAL_PLAN_ROUTE_KEY);
  if (!payload) return;

  try {
    const result = await planDesktopPatrolApprovalAction(payload, deps);
    const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
    await auditFn({
      actor,
      action: 'quality_patrol.desktop_approval.plan',
      entityType: 'desktop_patrol_proposal',
      entityId: result.proposalId,
      traceId,
      requestId,
      payloadSummary: {
        approvalStage: result.approvalStage || null,
        approvalStatus: result.approvalStatus || null,
        nextArtifactKind: result.nextArtifactKind || null,
        planHash: result.planHash || null
      }
    }).catch((auditErr) => {
      logRouteError('admin.quality_patrol.desktop_approval.plan.audit', auditErr, { actor, traceId, requestId });
    });
    writeJson(res, 200, Object.assign({ traceId, requestId }, result), {
      guard: { routeKey: APPROVAL_PLAN_ROUTE_KEY },
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError('admin.quality_patrol.desktop_approval.plan', err, { actor, traceId, requestId });
    writeKnownError(res, err, APPROVAL_PLAN_ROUTE_KEY, traceId, requestId);
  }
}

async function handleQualityPatrolApprovalExecute(req, res, bodyText, deps) {
  const payload = parseJsonBody(bodyText, res, APPROVAL_EXECUTE_ACTION);
  if (!payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: APPROVAL_EXECUTE_ACTION,
    payload
  }, deps);
  if (!guard) return;
  const actor = guard.actor || requireActor(req, res);
  if (!actor) return;
  const traceId = guard.traceId || resolveTraceId(req);
  const requestId = resolveRequestId(req);

  try {
    const planned = await planDesktopPatrolApprovalAction(payload, deps);
    if (payload.planHash !== planned.planHash) {
      writeJson(res, 409, {
        ok: false,
        error: 'desktop_patrol_approval_plan_stale',
        traceId,
        requestId,
        expectedPlanHash: planned.planHash
      }, {
        guard: { routeKey: `admin.${APPROVAL_EXECUTE_ACTION}` },
        state: 'blocked',
        reason: 'desktop_patrol_approval_plan_stale'
      });
      return;
    }
    const tokenOk = verifyConfirmToken(
      payload.confirmToken,
      buildPromotionApprovalConfirmTokenData(payload.planHash),
      { now: new Date() }
    );
    if (!tokenOk) {
      writeJson(res, 409, {
        ok: false,
        error: 'desktop_patrol_approval_confirm_invalid',
        traceId,
        requestId
      }, {
        guard: { routeKey: `admin.${APPROVAL_EXECUTE_ACTION}` },
        state: 'blocked',
        reason: 'desktop_patrol_approval_confirm_invalid'
      });
      return;
    }
    const result = await executeDesktopPatrolApprovalAction(Object.assign({}, payload, {
      plan: planned
    }), deps);
    const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
    await auditFn({
      actor,
      action: 'quality_patrol.desktop_approval.execute',
      entityType: 'desktop_patrol_proposal',
      entityId: result.proposalId,
      traceId,
      requestId,
      payloadSummary: {
        approvalStage: result.approvalStage || null,
        nextArtifactKind: result.nextArtifactKind || null,
        expectedReadyStatus: result.expectedReadyStatus || null,
        executionStatus: result.executionResult && result.executionResult.status
          ? result.executionResult.status
          : null
      }
    }).catch((auditErr) => {
      logRouteError('admin.quality_patrol.desktop_approval.execute.audit', auditErr, { actor, traceId, requestId });
    });
    writeJson(res, 200, Object.assign({ traceId, requestId }, result), {
      guard: { routeKey: `admin.${APPROVAL_EXECUTE_ACTION}` },
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError('admin.quality_patrol.desktop_approval.execute', err, { actor, traceId, requestId });
    writeKnownError(res, err, `admin.${APPROVAL_EXECUTE_ACTION}`, traceId, requestId);
  }
}

module.exports = {
  handleQualityPatrolQuery,
  handleQualityPatrolApprovalPlan,
  handleQualityPatrolApprovalExecute
};
