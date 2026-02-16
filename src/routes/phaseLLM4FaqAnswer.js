'use strict';

const { getFaqAnswer } = require('../usecases/phaseLLM4/getFaqAnswer');

async function handleFaqAnswer(req, res, body) {
  try {
    const payload = body ? JSON.parse(body) : {};
    const traceId = req.headers['x-trace-id'] || null;
    const result = await getFaqAnswer({
      question: payload.question,
      sourceIds: payload.sourceIds,
      traceId
    });
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
  handleFaqAnswer
};
