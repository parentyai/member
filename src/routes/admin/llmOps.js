'use strict';

const { getOpsExplanation } = require('../../usecases/phaseLLM2/getOpsExplanation');
const { getNextActionCandidates } = require('../../usecases/phaseLLM3/getNextActionCandidates');
const { appendLlmGateDecision } = require('../../usecases/llm/appendLlmGateDecision');
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
      entryType: 'admin',
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
      entryType: 'admin',
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
