'use strict';

const { getNextActionCandidates } = require('../usecases/phaseLLM3/getNextActionCandidates');
const { appendLlmGateDecision } = require('../usecases/llm/appendLlmGateDecision');
const { enforceLlmGenerationKillSwitch } = require('./admin/osContext');

const COMPAT_ROUTE_ID = 'compat_phaseLLM3_ops_next_actions';

function buildCompatQualitySignals(result) {
  const payload = result && typeof result === 'object' ? result : {};
  const llmUsed = payload.llmUsed === true;
  const actionCount = payload.nextActionCandidates
    && Array.isArray(payload.nextActionCandidates.candidates)
    ? Math.min(3, payload.nextActionCandidates.candidates.length)
    : 0;
  return {
    legacyTemplateHit: false,
    conciseModeApplied: true,
    directAnswerApplied: llmUsed,
    clarifySuppressed: llmUsed,
    repetitionPrevented: true,
    followupQuestionIncluded: false,
    actionCount,
    pitfallIncluded: false,
    domainIntent: 'general',
    fallbackType: llmUsed ? null : 'compat_ops_blocked',
    contextCarryScore: llmUsed ? 0.78 : 0.35,
    repeatRiskScore: llmUsed ? 0.1 : 0.3
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
