'use strict';

const { getOpsExplanation } = require('../../usecases/phaseLLM2/getOpsExplanation');
const { getNextActionCandidates } = require('../../usecases/phaseLLM3/getNextActionCandidates');
const { appendLlmGateDecision } = require('../../usecases/llm/appendLlmGateDecision');
const { resolveSharedAnswerReadiness } = require('../../domain/llm/quality/resolveSharedAnswerReadiness');
const { resolveLlmLegalPolicySnapshot } = require('../../domain/llm/policy/resolveLlmLegalPolicySnapshot');
const { resolveV1FeatureMatrix } = require('../../v1/shared/featureMatrix');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { requireActor, resolveTraceId } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const OPS_EXPLAIN_ROUTE_KEY = 'admin.llm_ops_explain';
const NEXT_ACTIONS_ROUTE_KEY = 'admin.llm_next_actions';

function buildOpsQualitySignals(result, mode) {
  const payload = result && typeof result === 'object' ? result : {};
  const llmUsed = payload.llmUsed === true;
  const nextActionCount = mode === 'next_actions'
    ? (
      payload.nextActionCandidates
      && Array.isArray(payload.nextActionCandidates.candidates)
      ? Math.min(3, payload.nextActionCandidates.candidates.length)
      : 0
    )
    : (
      payload.opsTemplate
      && payload.opsTemplate.proposal
      && payload.opsTemplate.proposal.recommendedNextAction
      ? 1
      : 0
    );
  const hasActionPayload = nextActionCount > 0;
  return {
    legacyTemplateHit: false,
    conciseModeApplied: true,
    directAnswerApplied: hasActionPayload,
    clarifySuppressed: hasActionPayload,
    repetitionPrevented: true,
    followupQuestionIncluded: false,
    actionCount: nextActionCount,
    pitfallIncluded: false,
    domainIntent: 'general',
    fallbackType: hasActionPayload ? null : 'ops_blocked',
    contextCarryScore: hasActionPayload ? (llmUsed ? 0.84 : 0.76) : 0.35,
    repeatRiskScore: hasActionPayload ? 0.1 : 0.3
  };
}

function readLineUserId(req) {
  const url = new URL(req.url, 'http://localhost');
  return url.searchParams.get('lineUserId');
}

function readActor(req) {
  const actor = req && req.headers ? req.headers['x-actor'] : '';
  if (typeof actor !== 'string') return '';
  return actor.trim();
}

function touchSharedActorGuard(req) {
  requireActor(req, {
    writeHead() {},
    end() {}
  });
}

function normalizeOutcomeReason(value, fallback) {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    : '';
  if (!normalized) return fallback;
  if (normalized === 'lineuserid_required') return 'line_user_id_required';
  return normalized;
}

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, routeKey, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendBadRequest(res, routeKey, message, outcomeOptions) {
  const options = Object.assign({
    state: 'error',
    reason: normalizeOutcomeReason(message, 'invalid_request')
  }, outcomeOptions || {});
  writeJson(res, routeKey, 400, { ok: false, error: message }, options);
}

function sendServerError(res, routeKey) {
  writeJson(res, routeKey, 500, { ok: false, error: 'error' }, {
    state: 'error',
    reason: 'error'
  });
}

function resolveResultOutcome(result) {
  if (result && result.llmUsed === true) {
    return { state: 'success', reason: 'completed' };
  }
  return {
    state: 'blocked',
    reason: normalizeOutcomeReason(result && result.llmStatus, 'llm_blocked')
  };
}

async function handleAdminLlmOpsExplain(req, res, deps) {
  try {
    const lineUserId = readLineUserId(req);
    if (!lineUserId) {
      sendBadRequest(res, OPS_EXPLAIN_ROUTE_KEY, 'lineUserId required', {
        reason: 'line_user_id_required'
      });
      return;
    }
    const actor = readActor(req);
    if (!actor) {
      touchSharedActorGuard(req);
      sendBadRequest(res, OPS_EXPLAIN_ROUTE_KEY, 'x-actor required', {
        reason: 'x_actor_required'
      });
      return;
    }
    const traceId = resolveTraceId(req);
    const result = await getOpsExplanation({ lineUserId, traceId, actor }, deps);
    const qualitySignals = buildOpsQualitySignals(result, 'ops_explain');
    const v1Matrix = resolveV1FeatureMatrix();
    const legalSnapshot = resolveLlmLegalPolicySnapshot({
      policy: { lawfulBasis: 'consent', consentVerified: true, crossBorder: false },
      policySource: 'admin_ops_default',
      policyContext: 'admin_ops'
    });
    const opsExplanationText = result && result.explanation && typeof result.explanation.opsExplanation === 'string'
      ? result.explanation.opsExplanation
      : '';
    const sharedReadiness = resolveSharedAnswerReadiness({
      entryType: 'admin',
      routeKind: 'canonical',
      routerReason: 'admin_ops_explain',
      sharedReadinessBridge: 'shared_admin_ops_explain',
      routeDecisionSource: 'admin_route',
      domainIntent: 'general',
      llmUsed: result && result.llmUsed === true,
      fallbackType: qualitySignals.fallbackType,
      replyText: opsExplanationText,
      lawfulBasis: legalSnapshot.lawfulBasis,
      consentVerified: legalSnapshot.consentVerified,
      crossBorder: legalSnapshot.crossBorder,
      legalDecision: legalSnapshot.legalDecision,
      sourceReadinessDecision: result && result.llmUsed === true ? 'allow' : 'clarify',
      actionGatewayEnabled: v1Matrix.actionGateway === true,
      actionClass: 'lookup',
      toolName: 'lookup'
    });
    if (result && result.explanation && typeof result.explanation === 'object' && opsExplanationText) {
      result.explanation.opsExplanation = sharedReadiness.replyText;
    }
    result.routeKind = sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.routeKind : 'canonical';
    result.routerReason = sharedReadiness.routeCoverageMeta && sharedReadiness.routeCoverageMeta.routerReason
      ? sharedReadiness.routeCoverageMeta.routerReason
      : 'admin_ops_explain';
    result.routerReasonObserved = sharedReadiness.routeCoverageMeta
      ? sharedReadiness.routeCoverageMeta.routerReasonObserved === true
      : true;
    result.compatFallbackReason = sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.compatFallbackReason : null;
    result.sharedReadinessBridge = sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.sharedReadinessBridge : null;
    result.sharedReadinessBridgeObserved = sharedReadiness.routeCoverageMeta
      ? sharedReadiness.routeCoverageMeta.sharedReadinessBridgeObserved === true
      : false;
    result.routeDecisionSource = sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.routeDecisionSource : 'admin_route';
    result.entryType = 'admin';
    result.readinessDecision = sharedReadiness.readiness.decision;
    result.readinessReasonCodes = sharedReadiness.readiness.reasonCodes;
    result.readinessSafeResponseMode = sharedReadiness.readiness.safeResponseMode;
    result.intentRiskTier = sharedReadiness.intentRiskTier;
    result.responseQualityContextVersion = sharedReadiness.responseQualityContextVersion || null;
    result.responseQualityVerdictVersion = sharedReadiness.responseQualityVerdictVersion || null;
    await appendLlmGateDecision({
      actor,
      traceId,
      lineUserId,
      plan: 'admin',
      status: result && result.llmStatus ? result.llmStatus : 'unknown',
      intent: 'ops_explain',
      decision: result && result.llmUsed === true ? 'allow' : 'blocked',
      blockedReason: result && result.llmUsed === true ? null : (result && result.llmStatus ? result.llmStatus : 'blocked'),
      model: result && result.llmModel ? result.llmModel : null,
      legacyTemplateHit: qualitySignals.legacyTemplateHit,
      conciseModeApplied: qualitySignals.conciseModeApplied,
      directAnswerApplied: qualitySignals.directAnswerApplied,
      clarifySuppressed: qualitySignals.clarifySuppressed,
      repetitionPrevented: qualitySignals.repetitionPrevented,
      followupQuestionIncluded: qualitySignals.followupQuestionIncluded,
      actionCount: qualitySignals.actionCount,
      pitfallIncluded: qualitySignals.pitfallIncluded,
      domainIntent: qualitySignals.domainIntent,
      fallbackType: qualitySignals.fallbackType,
      contextCarryScore: qualitySignals.contextCarryScore,
      repeatRiskScore: qualitySignals.repeatRiskScore,
      policySource: legalSnapshot.policySource,
      policyContext: legalSnapshot.policyContext,
      legalDecision: legalSnapshot.legalDecision,
      legalReasonCodes: legalSnapshot.legalReasonCodes,
      readinessDecision: sharedReadiness.readiness.decision,
      readinessReasonCodes: sharedReadiness.readiness.reasonCodes,
      readinessSafeResponseMode: sharedReadiness.readiness.safeResponseMode,
      answerReadinessLogOnly: false,
      answerReadinessVersion: sharedReadiness.answerReadinessVersion,
      responseQualityContextVersion: sharedReadiness.responseQualityContextVersion || null,
      responseQualityVerdictVersion: sharedReadiness.responseQualityVerdictVersion || null,
      answerReadinessLogOnlyV2: sharedReadiness.answerReadinessLogOnlyV2,
      answerReadinessEnforcedV2: sharedReadiness.answerReadinessEnforcedV2,
      answerReadinessV2Mode: sharedReadiness.answerReadinessV2Mode,
      answerReadinessV2Stage: sharedReadiness.answerReadinessV2Stage,
      answerReadinessV2EnforcementReason: sharedReadiness.answerReadinessV2EnforcementReason,
      readinessDecisionV2: sharedReadiness.readinessV2 ? sharedReadiness.readinessV2.decision : null,
      readinessReasonCodesV2: sharedReadiness.readinessV2 ? sharedReadiness.readinessV2.reasonCodes : [],
      readinessSafeResponseModeV2: sharedReadiness.readinessV2 ? sharedReadiness.readinessV2.safeResponseMode : null,
      intentRiskTier: sharedReadiness.intentRiskTier,
      actionClass: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.actionClass : null,
      actionGatewayEnabled: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.enabled === true : false,
      actionGatewayEnforced: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.enforced === true : false,
      actionGatewayAllowed: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.allowed === true : true,
      actionGatewayDecision: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.decision : null,
      actionGatewayReason: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.reason : null,
      entryType: 'admin',
      routeKind: sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.routeKind : 'canonical',
      routerReason: sharedReadiness.routeCoverageMeta && sharedReadiness.routeCoverageMeta.routerReason
        ? sharedReadiness.routeCoverageMeta.routerReason
        : 'admin_ops_explain',
      routerReasonObserved: sharedReadiness.routeCoverageMeta
        ? sharedReadiness.routeCoverageMeta.routerReasonObserved === true
        : true,
      compatFallbackReason: sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.compatFallbackReason : null,
      sharedReadinessBridge: sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.sharedReadinessBridge : null,
      sharedReadinessBridgeObserved: sharedReadiness.routeCoverageMeta
        ? sharedReadiness.routeCoverageMeta.sharedReadinessBridgeObserved === true
        : false,
      routeDecisionSource: sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.routeDecisionSource : 'admin_route',
      gatesApplied: ['kill_switch']
    }).catch(() => null);
    writeJson(res, OPS_EXPLAIN_ROUTE_KEY, 200, result, resolveResultOutcome(result));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('invalid')) {
      sendBadRequest(res, OPS_EXPLAIN_ROUTE_KEY, message);
      return;
    }
    sendServerError(res, OPS_EXPLAIN_ROUTE_KEY);
  }
}

async function handleAdminLlmNextActions(req, res, deps) {
  try {
    const lineUserId = readLineUserId(req);
    if (!lineUserId) {
      sendBadRequest(res, NEXT_ACTIONS_ROUTE_KEY, 'lineUserId required', {
        reason: 'line_user_id_required'
      });
      return;
    }
    const actor = readActor(req);
    if (!actor) {
      touchSharedActorGuard(req);
      sendBadRequest(res, NEXT_ACTIONS_ROUTE_KEY, 'x-actor required', {
        reason: 'x_actor_required'
      });
      return;
    }
    const traceId = resolveTraceId(req);
    const result = await getNextActionCandidates({ lineUserId, traceId, actor }, deps);
    const qualitySignals = buildOpsQualitySignals(result, 'next_actions');
    const v1Matrix = resolveV1FeatureMatrix();
    const legalSnapshot = resolveLlmLegalPolicySnapshot({
      policy: { lawfulBasis: 'consent', consentVerified: true, crossBorder: false },
      policySource: 'admin_ops_default',
      policyContext: 'admin_ops'
    });
    const firstReason = result
      && result.nextActionCandidates
      && Array.isArray(result.nextActionCandidates.candidates)
      && result.nextActionCandidates.candidates[0]
      && typeof result.nextActionCandidates.candidates[0].reason === 'string'
      ? result.nextActionCandidates.candidates[0].reason
      : '';
    const sharedReadiness = resolveSharedAnswerReadiness({
      entryType: 'admin',
      routeKind: 'canonical',
      routerReason: 'admin_next_actions',
      sharedReadinessBridge: 'shared_admin_next_actions',
      routeDecisionSource: 'admin_route',
      domainIntent: 'general',
      llmUsed: result && result.llmUsed === true,
      fallbackType: qualitySignals.fallbackType,
      replyText: firstReason,
      lawfulBasis: legalSnapshot.lawfulBasis,
      consentVerified: legalSnapshot.consentVerified,
      crossBorder: legalSnapshot.crossBorder,
      legalDecision: legalSnapshot.legalDecision,
      sourceReadinessDecision: result && result.llmUsed === true ? 'allow' : 'clarify',
      actionGatewayEnabled: v1Matrix.actionGateway === true,
      actionClass: 'lookup',
      toolName: 'lookup'
    });
    result.readinessDecision = sharedReadiness.readiness.decision;
    result.routeKind = sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.routeKind : 'canonical';
    result.routerReason = sharedReadiness.routeCoverageMeta && sharedReadiness.routeCoverageMeta.routerReason
      ? sharedReadiness.routeCoverageMeta.routerReason
      : 'admin_next_actions';
    result.routerReasonObserved = sharedReadiness.routeCoverageMeta
      ? sharedReadiness.routeCoverageMeta.routerReasonObserved === true
      : true;
    result.compatFallbackReason = sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.compatFallbackReason : null;
    result.sharedReadinessBridge = sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.sharedReadinessBridge : null;
    result.sharedReadinessBridgeObserved = sharedReadiness.routeCoverageMeta
      ? sharedReadiness.routeCoverageMeta.sharedReadinessBridgeObserved === true
      : false;
    result.routeDecisionSource = sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.routeDecisionSource : 'admin_route';
    result.entryType = 'admin';
    result.readinessReasonCodes = sharedReadiness.readiness.reasonCodes;
    result.readinessSafeResponseMode = sharedReadiness.readiness.safeResponseMode;
    result.intentRiskTier = sharedReadiness.intentRiskTier;
    result.responseQualityContextVersion = sharedReadiness.responseQualityContextVersion || null;
    result.responseQualityVerdictVersion = sharedReadiness.responseQualityVerdictVersion || null;
    await appendLlmGateDecision({
      actor,
      traceId,
      lineUserId,
      plan: 'admin',
      status: result && result.llmStatus ? result.llmStatus : 'unknown',
      intent: 'next_actions',
      decision: result && result.llmUsed === true ? 'allow' : 'blocked',
      blockedReason: result && result.llmUsed === true ? null : (result && result.llmStatus ? result.llmStatus : 'blocked'),
      model: result && result.llmModel ? result.llmModel : null,
      legacyTemplateHit: qualitySignals.legacyTemplateHit,
      conciseModeApplied: qualitySignals.conciseModeApplied,
      directAnswerApplied: qualitySignals.directAnswerApplied,
      clarifySuppressed: qualitySignals.clarifySuppressed,
      repetitionPrevented: qualitySignals.repetitionPrevented,
      followupQuestionIncluded: qualitySignals.followupQuestionIncluded,
      actionCount: qualitySignals.actionCount,
      pitfallIncluded: qualitySignals.pitfallIncluded,
      domainIntent: qualitySignals.domainIntent,
      fallbackType: qualitySignals.fallbackType,
      contextCarryScore: qualitySignals.contextCarryScore,
      repeatRiskScore: qualitySignals.repeatRiskScore,
      policySource: legalSnapshot.policySource,
      policyContext: legalSnapshot.policyContext,
      legalDecision: legalSnapshot.legalDecision,
      legalReasonCodes: legalSnapshot.legalReasonCodes,
      readinessDecision: sharedReadiness.readiness.decision,
      readinessReasonCodes: sharedReadiness.readiness.reasonCodes,
      readinessSafeResponseMode: sharedReadiness.readiness.safeResponseMode,
      answerReadinessLogOnly: false,
      answerReadinessVersion: sharedReadiness.answerReadinessVersion,
      responseQualityContextVersion: sharedReadiness.responseQualityContextVersion || null,
      responseQualityVerdictVersion: sharedReadiness.responseQualityVerdictVersion || null,
      answerReadinessLogOnlyV2: sharedReadiness.answerReadinessLogOnlyV2,
      answerReadinessEnforcedV2: sharedReadiness.answerReadinessEnforcedV2,
      answerReadinessV2Mode: sharedReadiness.answerReadinessV2Mode,
      answerReadinessV2Stage: sharedReadiness.answerReadinessV2Stage,
      answerReadinessV2EnforcementReason: sharedReadiness.answerReadinessV2EnforcementReason,
      readinessDecisionV2: sharedReadiness.readinessV2 ? sharedReadiness.readinessV2.decision : null,
      readinessReasonCodesV2: sharedReadiness.readinessV2 ? sharedReadiness.readinessV2.reasonCodes : [],
      readinessSafeResponseModeV2: sharedReadiness.readinessV2 ? sharedReadiness.readinessV2.safeResponseMode : null,
      intentRiskTier: sharedReadiness.intentRiskTier,
      actionClass: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.actionClass : null,
      actionGatewayEnabled: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.enabled === true : false,
      actionGatewayEnforced: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.enforced === true : false,
      actionGatewayAllowed: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.allowed === true : true,
      actionGatewayDecision: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.decision : null,
      actionGatewayReason: sharedReadiness.actionGateway ? sharedReadiness.actionGateway.reason : null,
      entryType: 'admin',
      routeKind: sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.routeKind : 'canonical',
      routerReason: sharedReadiness.routeCoverageMeta && sharedReadiness.routeCoverageMeta.routerReason
        ? sharedReadiness.routeCoverageMeta.routerReason
        : 'admin_next_actions',
      routerReasonObserved: sharedReadiness.routeCoverageMeta
        ? sharedReadiness.routeCoverageMeta.routerReasonObserved === true
        : true,
      compatFallbackReason: sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.compatFallbackReason : null,
      sharedReadinessBridge: sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.sharedReadinessBridge : null,
      sharedReadinessBridgeObserved: sharedReadiness.routeCoverageMeta
        ? sharedReadiness.routeCoverageMeta.sharedReadinessBridgeObserved === true
        : false,
      routeDecisionSource: sharedReadiness.routeCoverageMeta ? sharedReadiness.routeCoverageMeta.routeDecisionSource : 'admin_route',
      gatesApplied: ['kill_switch']
    }).catch(() => null);
    writeJson(res, NEXT_ACTIONS_ROUTE_KEY, 200, result, resolveResultOutcome(result));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('invalid')) {
      sendBadRequest(res, NEXT_ACTIONS_ROUTE_KEY, message);
      return;
    }
    sendServerError(res, NEXT_ACTIONS_ROUTE_KEY);
  }
}

module.exports = {
  handleAdminLlmOpsExplain,
  handleAdminLlmNextActions
};
