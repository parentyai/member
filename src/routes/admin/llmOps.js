'use strict';

const { getOpsExplanation } = require('../../usecases/phaseLLM2/getOpsExplanation');
const { getNextActionCandidates } = require('../../usecases/phaseLLM3/getNextActionCandidates');
const { resolveTraceId } = require('./osContext');

function readLineUserId(req) {
  const url = new URL(req.url, 'http://localhost');
  return url.searchParams.get('lineUserId');
}

function resolveActor(req, fallback) {
  const actor = req && req.headers && req.headers['x-actor'];
  if (typeof actor === 'string' && actor.trim().length > 0) return actor.trim();
  return fallback;
}

function sendBadRequest(res, message) {
  res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: message }));
}

function sendServerError(res) {
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleAdminLlmOpsExplain(req, res) {
  try {
    const lineUserId = readLineUserId(req);
    if (!lineUserId) {
      sendBadRequest(res, 'lineUserId required');
      return;
    }
    const traceId = resolveTraceId(req);
    const actor = resolveActor(req, 'admin_llm_ops_explain');
    const result = await getOpsExplanation({ lineUserId, traceId, actor });
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

async function handleAdminLlmNextActions(req, res) {
  try {
    const lineUserId = readLineUserId(req);
    if (!lineUserId) {
      sendBadRequest(res, 'lineUserId required');
      return;
    }
    const traceId = resolveTraceId(req);
    const actor = resolveActor(req, 'admin_llm_next_actions');
    const result = await getNextActionCandidates({ lineUserId, traceId, actor });
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
