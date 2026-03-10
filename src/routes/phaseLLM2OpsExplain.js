'use strict';

const { getOpsExplanation } = require('../usecases/phaseLLM2/getOpsExplanation');
const { appendLlmGateDecision } = require('../usecases/llm/appendLlmGateDecision');
const { resolveSharedAnswerReadiness } = require('../domain/llm/quality/resolveSharedAnswerReadiness');
const { resolveV1FeatureMatrix } = require('../v1/shared/featureMatrix');
const { enforceLlmGenerationKillSwitch } = require('./admin/osContext');

const COMPAT_ROUTE_ID = 'compat_phaseLLM2_ops_explain';

function buildCompatQualitySignals(result) {
  const payload = result && typeof result === 'object' ? result : {};
  const llmUsed = payload.llmUsed === true;
  const explanation = typeof payload.opsExplanation === 'string' ? payload.opsExplanation.trim() : '';
  const hasDirectAnswer = explanation.length > 0;
  const actionCount = payload.opsTemplate
    && payload.opsTemplate.proposal
    && payload.opsTemplate.proposal.recommendedNextAction
    ? 1
    : 0;
  const followupQuestionIncluded = /\?\s*$|？\s*$/.test(explanation);
  const conciseModeApplied = hasDirectAnswer ? explanation.length <= 240 : true;
  const directAnswerApplied = hasDirectAnswer || actionCount > 0;
  return {
    legacyTemplateHit: false,
    conciseModeApplied,
    directAnswerApplied,
    clarifySuppressed: directAnswerApplied,
    repetitionPrevented: true,
    followupQuestionIncluded,
    actionCount,
    pitfallIncluded: false,
    domainIntent: 'general',
    fallbackType: directAnswerApplied ? null : (llmUsed ? null : 'compat_ops_blocked'),
    contextCarryScore: directAnswerApplied ? 0.82 : 0.35,
    repeatRiskScore: directAnswerApplied ? 0.08 : 0.3
  };
}

async function handleOpsExplain(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const lineUserId = url.searchParams.get('lineUserId');
    if (!lineUserId) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'lineUserId required' }));
      return;
    }
    const traceId = req.headers['x-trace-id'] || null;
    const actor = req.headers['x-actor'] || 'phaseLLM2_ops_explain';
    const allowed = await enforceLlmGenerationKillSwitch(req, res, {
      routeKey: COMPAT_ROUTE_ID,
      actor,
      traceId
    });
    if (!allowed) return;
    const result = await getOpsExplanation({ lineUserId, traceId, actor });
    const qualitySignals = buildCompatQualitySignals(result);
    const v1Matrix = resolveV1FeatureMatrix();
    const opsExplanationText = result && result.explanation && typeof result.explanation.opsExplanation === 'string'
      ? result.explanation.opsExplanation
      : '';
    const sharedReadiness = resolveSharedAnswerReadiness({
      domainIntent: 'general',
      llmUsed: result && result.llmUsed === true,
      fallbackType: qualitySignals.fallbackType,
      replyText: opsExplanationText,
      lawfulBasis: 'consent',
      consentVerified: true,
      legalDecision: 'allow',
      sourceReadinessDecision: result && result.llmUsed === true ? 'allow' : 'clarify',
      actionGatewayEnabled: v1Matrix.actionGateway === true,
      actionClass: 'lookup',
      toolName: 'lookup'
    });
    if (result && result.explanation && typeof result.explanation === 'object' && opsExplanationText) {
      result.explanation.opsExplanation = sharedReadiness.replyText;
    }
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
      readinessDecision: sharedReadiness.readiness.decision,
      readinessReasonCodes: sharedReadiness.readiness.reasonCodes,
      readinessSafeResponseMode: sharedReadiness.readiness.safeResponseMode,
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
  handleOpsExplain
};
