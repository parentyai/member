'use strict';

const { getOpsExplanation } = require('../../usecases/phaseLLM2/getOpsExplanation');
const { getNextActionCandidates } = require('../../usecases/phaseLLM3/getNextActionCandidates');
const { appendLlmGateDecision } = require('../../usecases/llm/appendLlmGateDecision');
const { resolveSharedAnswerReadiness } = require('../../domain/llm/quality/resolveSharedAnswerReadiness');
const { resolveLlmLegalPolicySnapshot } = require('../../domain/llm/policy/resolveLlmLegalPolicySnapshot');
const { resolveV1FeatureMatrix } = require('../../v1/shared/featureMatrix');
const { requireActor, resolveTraceId } = require('./osContext');

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

function sendBadRequest(res, message) {
  res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: message }));
}

function sendServerError(res) {
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleAdminLlmOpsExplain(req, res, deps) {
  try {
    const lineUserId = readLineUserId(req);
    if (!lineUserId) {
      sendBadRequest(res, 'lineUserId required');
      return;
    }
    const actor = requireActor(req, res);
    if (!actor) return;
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('invalid')) {
      sendBadRequest(res, message);
      return;
    }
    sendServerError(res);
  }
}

async function handleAdminLlmNextActions(req, res, deps) {
  try {
    const lineUserId = readLineUserId(req);
    if (!lineUserId) {
      sendBadRequest(res, 'lineUserId required');
      return;
    }
    const actor = requireActor(req, res);
    if (!actor) return;
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('invalid')) {
      sendBadRequest(res, message);
      return;
    }
    sendServerError(res);
  }
}

module.exports = {
  handleAdminLlmOpsExplain,
  handleAdminLlmNextActions
};
