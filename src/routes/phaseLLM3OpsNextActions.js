'use strict';

const { getNextActionCandidates } = require('../usecases/phaseLLM3/getNextActionCandidates');
const { appendLlmGateDecision } = require('../usecases/llm/appendLlmGateDecision');
const { resolveSharedAnswerReadiness } = require('../domain/llm/quality/resolveSharedAnswerReadiness');
const { resolveLlmLegalPolicySnapshot } = require('../domain/llm/policy/resolveLlmLegalPolicySnapshot');
const { resolveV1FeatureMatrix } = require('../v1/shared/featureMatrix');
const { enforceLlmGenerationKillSwitch } = require('./admin/osContext');

const COMPAT_ROUTE_ID = 'compat_phaseLLM3_ops_next_actions';

function buildCompatQualitySignals(result) {
  const payload = result && typeof result === 'object' ? result : {};
  const llmUsed = payload.llmUsed === true;
  const candidates = payload.nextActionCandidates
    && Array.isArray(payload.nextActionCandidates.candidates)
    ? payload.nextActionCandidates.candidates
    : [];
  const actionCount = payload.nextActionCandidates
    && Array.isArray(payload.nextActionCandidates.candidates)
    ? Math.min(3, payload.nextActionCandidates.candidates.length)
    : 0;
  const hasDirectAnswer = actionCount > 0;
  const firstCandidate = hasDirectAnswer ? String(candidates[0] || '').trim() : '';
  const followupQuestionIncluded = /\?\s*$|？\s*$/.test(firstCandidate);
  const conciseModeApplied = hasDirectAnswer ? firstCandidate.length <= 240 : true;
  return {
    legacyTemplateHit: false,
    conciseModeApplied,
    directAnswerApplied: hasDirectAnswer,
    clarifySuppressed: hasDirectAnswer,
    repetitionPrevented: true,
    followupQuestionIncluded,
    actionCount,
    pitfallIncluded: false,
    domainIntent: 'general',
    fallbackType: hasDirectAnswer ? null : (llmUsed ? null : 'compat_ops_blocked'),
    contextCarryScore: hasDirectAnswer ? 0.82 : 0.35,
    repeatRiskScore: hasDirectAnswer ? 0.08 : 0.3
  };
}

async function handleOpsNextActions(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const lineUserId = url.searchParams.get('lineUserId');
    if (!lineUserId) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'lineUserId required' }));
      return;
    }
    const traceId = req.headers['x-trace-id'] || null;
    const actor = req.headers['x-actor'] || 'phaseLLM3_ops_next_actions';
    const allowed = await enforceLlmGenerationKillSwitch(req, res, {
      routeKey: COMPAT_ROUTE_ID,
      actor,
      traceId
    });
    if (!allowed) return;
    const result = await getNextActionCandidates({ lineUserId, traceId, actor });
    const qualitySignals = buildCompatQualitySignals(result);
    const v1Matrix = resolveV1FeatureMatrix();
    const legalSnapshot = resolveLlmLegalPolicySnapshot({
      policy: { lawfulBasis: 'consent', consentVerified: true, crossBorder: false },
      policySource: 'compat_ops_default',
      policyContext: 'compat_ops'
    });
    const firstReason = result
      && result.nextActionCandidates
      && Array.isArray(result.nextActionCandidates.candidates)
      && result.nextActionCandidates.candidates[0]
      && typeof result.nextActionCandidates.candidates[0].reason === 'string'
      ? result.nextActionCandidates.candidates[0].reason
      : '';
    const sharedReadiness = resolveSharedAnswerReadiness({
      entryType: 'compat',
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
      entryType: 'compat',
      gatesApplied: ['kill_switch']
    }).catch(() => null);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('invalid')) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: message }));
      return;
    }
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error' }));
  }
}

module.exports = {
  handleOpsNextActions
};
