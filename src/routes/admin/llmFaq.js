'use strict';

const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { answerFaqFromKb } = require('../../usecases/faq/answerFaqFromKb');
const { appendLlmGateDecision } = require('../../usecases/llm/appendLlmGateDecision');
const { parseJson, resolveActor, resolveRequestId, resolveTraceId } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.llm_faq_answer';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function buildFaqQualitySignals(result, blockedReason) {
  const payload = result && typeof result === 'object' ? result : {};
  const answer = payload.faqAnswer && typeof payload.faqAnswer === 'object'
    ? normalizeText(payload.faqAnswer.answer)
    : '';
  const hasAnswer = answer.length > 0;
  const llmUsed = payload.llmUsed === true;
  return {
    legacyTemplateHit: false,
    conciseModeApplied: hasAnswer ? answer.length <= 240 : true,
    directAnswerApplied: hasAnswer,
    clarifySuppressed: hasAnswer,
    repetitionPrevented: true,
    followupQuestionIncluded: /[?？]$/.test(answer),
    actionCount: hasAnswer ? 1 : 0,
    pitfallIncluded: false,
    domainIntent: 'general',
    fallbackType: blockedReason ? 'faq_blocked' : null,
    contextCarryScore: hasAnswer ? (llmUsed ? 0.84 : 0.78) : 0.35,
    repeatRiskScore: hasAnswer ? 0.08 : 0.3
  };
}

function handleError(res, err, traceId) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid')) {
    writeJson(res, 400, { ok: false, error: message, traceId }, {
      state: 'error',
      reason: `${String(message).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'invalid_request'}`
    });
    return;
  }
  writeJson(res, 500, { ok: false, error: 'error', traceId }, {
    state: 'error',
    reason: 'error'
  });
}

async function handleAdminLlmFaqAnswer(req, res, body, deps) {
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const actor = resolveActor(req) || 'admin_llm_faq';
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await answerFaqFromKb({
      question: payload.question,
      locale: payload.locale,
      intent: payload.intent,
      guideMode: payload.guideMode,
      personalization: payload.personalization,
      entryType: 'faq',
      traceId,
      requestId,
      actor
    }, deps);
    const lineUserId = typeof payload.lineUserId === 'string' && payload.lineUserId.trim()
      ? payload.lineUserId.trim()
      : null;
    const blockedReason = result && result.blocked === true
      ? (result.blockedReason || result.llmStatus || 'blocked')
      : null;
    const qualitySignals = buildFaqQualitySignals(result, blockedReason);
    result.routeKind = 'canonical';
    result.routerReason = 'admin_faq_answer';
    result.routerReasonObserved = true;
    result.compatFallbackReason = null;
    result.sharedReadinessBridge = 'shared_admin_faq';
    result.sharedReadinessBridgeObserved = true;
    result.routeDecisionSource = 'admin_route';
    result.entryType = 'admin';
    await appendLlmGateDecision({
      actor,
      traceId,
      requestId,
      lineUserId,
      plan: 'admin',
      status: result && result.llmStatus ? result.llmStatus : (blockedReason ? 'blocked' : 'ok'),
      intent: payload.intent || 'faq_search',
      decision: blockedReason ? 'blocked' : 'allow',
      blockedReason,
      model: result && result.llmModel ? result.llmModel : null,
      sanitizeApplied: result && result.sanitizeApplied === true,
      sanitizedCandidateCount: result && Number.isFinite(Number(result.sanitizedCandidateCount))
        ? Number(result.sanitizedCandidateCount)
        : 0,
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
      policySource: result && result.policySource ? result.policySource : null,
      policyContext: result && result.policyContext ? result.policyContext : null,
      legalDecision: result && result.legalDecision ? result.legalDecision : null,
      legalReasonCodes: result && Array.isArray(result.legalReasonCodes) ? result.legalReasonCodes : [],
      intentRiskTier: result && result.intentRiskTier ? result.intentRiskTier : null,
      riskReasonCodes: result && Array.isArray(result.riskReasonCodes) ? result.riskReasonCodes : [],
      sourceReadinessDecision: result && result.sourceReadinessDecision ? result.sourceReadinessDecision : null,
      sourceReadinessReasons: result && Array.isArray(result.sourceReadinessReasons) ? result.sourceReadinessReasons : [],
      readinessDecision: result && result.readinessDecision ? result.readinessDecision : null,
      readinessReasonCodes: result && Array.isArray(result.readinessReasonCodes)
        ? result.readinessReasonCodes
        : [],
      readinessSafeResponseMode: result && result.readinessSafeResponseMode ? result.readinessSafeResponseMode : null,
      answerReadinessLogOnly: result ? result.answerReadinessLogOnly === true : false,
      answerReadinessVersion: result && result.answerReadinessVersion ? result.answerReadinessVersion : null,
      responseQualityContextVersion: result && result.responseQualityContextVersion ? result.responseQualityContextVersion : null,
      responseQualityVerdictVersion: result && result.responseQualityVerdictVersion ? result.responseQualityVerdictVersion : null,
      answerReadinessLogOnlyV2: result ? result.answerReadinessLogOnlyV2 === true : false,
      answerReadinessEnforcedV2: result ? result.answerReadinessEnforcedV2 === true : false,
      answerReadinessV2Mode: result && result.answerReadinessV2Mode ? result.answerReadinessV2Mode : null,
      answerReadinessV2Stage: result && result.answerReadinessV2Stage ? result.answerReadinessV2Stage : null,
      answerReadinessV2EnforcementReason: result && result.answerReadinessV2EnforcementReason
        ? result.answerReadinessV2EnforcementReason
        : null,
      readinessDecisionV2: result && result.readinessDecisionV2 ? result.readinessDecisionV2 : null,
      readinessReasonCodesV2: result && Array.isArray(result.readinessReasonCodesV2)
        ? result.readinessReasonCodesV2
        : [],
      readinessSafeResponseModeV2: result && result.readinessSafeResponseModeV2 ? result.readinessSafeResponseModeV2 : null,
      savedFaqReused: result ? result.savedFaqReused === true : false,
      savedFaqReusePass: result ? result.savedFaqReusePass === true : false,
      savedFaqReuseReasonCodes: result && Array.isArray(result.savedFaqReuseReasonCodes)
        ? result.savedFaqReuseReasonCodes
        : [],
      sourceSnapshotRefs: result && Array.isArray(result.sourceSnapshotRefs) ? result.sourceSnapshotRefs : [],
      unsupportedClaimCount: result && Number.isFinite(Number(result.unsupportedClaimCount))
        ? Number(result.unsupportedClaimCount)
        : 0,
      contradictionDetected: result ? result.contradictionDetected === true : false,
      entryType: 'admin',
      routeKind: 'canonical',
      routerReason: 'admin_faq_answer',
      routerReasonObserved: true,
      compatFallbackReason: null,
      sharedReadinessBridge: 'shared_admin_faq',
      sharedReadinessBridgeObserved: true,
      routeDecisionSource: 'admin_route',
      gatesApplied: ['kill_switch', 'injection', 'url_guard']
    }).catch(() => null);
    const status = result && Number.isInteger(result.httpStatus) ? result.httpStatus : 200;
    writeJson(res, status, result, blockedReason ? {
      state: 'blocked',
      reason: blockedReason
    } : {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, err, traceId);
  }
}

module.exports = {
  handleAdminLlmFaqAnswer
};
