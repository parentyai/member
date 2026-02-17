'use strict';

const { answerFaqFromKb } = require('../../usecases/faq/answerFaqFromKb');
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
