'use strict';

const { answerFaqFromKb } = require('../../usecases/faq/answerFaqFromKb');
const { appendLlmGateDecision } = require('../../usecases/llm/appendLlmGateDecision');
const { parseJson, resolveActor, resolveRequestId, resolveTraceId } = require('./osContext');

function handleError(res, err, traceId) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message, traceId }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error', traceId }));
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
      entryType: 'admin',
      gatesApplied: ['kill_switch', 'injection', 'url_guard']
    }).catch(() => null);
    const status = result && Number.isInteger(result.httpStatus) ? result.httpStatus : 200;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err, traceId);
  }
}

module.exports = {
  handleAdminLlmFaqAnswer
};
