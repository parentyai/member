'use strict';

const { answerFaqFromKb } = require('../usecases/faq/answerFaqFromKb');
const { appendLlmGateDecision } = require('../usecases/llm/appendLlmGateDecision');
const { enforceLlmGenerationKillSwitch } = require('./admin/osContext');

const LEGACY_SUCCESSOR = '/api/admin/llm/faq/answer';
const COMPAT_ROUTE_ID = 'compat_phaseLLM4_faq_answer';

function isLegacyRouteFreezeEnabled() {
  const raw = process.env.LEGACY_ROUTE_FREEZE_ENABLED;
  if (raw === undefined || raw === null || String(raw).trim() === '') return false; // compat default
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

async function handleFaqAnswer(req, res, body) {
  if (isLegacyRouteFreezeEnabled()) {
    res.writeHead(410, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'legacy route frozen', replacement: LEGACY_SUCCESSOR }));
    return;
  }
  try {
    const payload = body ? JSON.parse(body) : {};
    const traceId = req.headers['x-trace-id'] || null;
    const actor = req.headers['x-actor'] || 'phaseLLM4_faq_compat';
    const requestId = req.headers['x-request-id'] || null;
    const allowed = await enforceLlmGenerationKillSwitch(req, res, {
      routeKey: COMPAT_ROUTE_ID,
      actor,
      traceId,
      requestId
    });
    if (!allowed) return;
    const result = await answerFaqFromKb({
      question: payload.question,
      locale: payload.locale,
      intent: payload.intent,
      guideMode: payload.guideMode,
      personalization: payload.personalization,
      traceId,
      actor,
      requestId
    });
    const blockedReason = result && result.blocked === true
      ? (result.blockedReason || result.llmStatus || 'blocked')
      : null;
    await appendLlmGateDecision({
      actor,
      traceId,
      requestId,
      lineUserId: typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : null,
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
      entryType: 'compat',
      gatesApplied: ['kill_switch', 'injection', 'url_guard']
    }).catch(() => null);
    const status = result && Number.isInteger(result.httpStatus) ? result.httpStatus : 200;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({}, result, {
      deprecated: true,
      replacement: LEGACY_SUCCESSOR
    })));
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
  handleFaqAnswer
};
