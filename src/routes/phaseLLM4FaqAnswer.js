'use strict';

const { answerFaqFromKb } = require('../usecases/faq/answerFaqFromKb');

const LEGACY_SUCCESSOR = '/api/admin/llm/faq/answer';

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
