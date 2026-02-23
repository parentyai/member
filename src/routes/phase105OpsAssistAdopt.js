'use strict';

const { appendLlmAdoptAudit } = require('../usecases/phase105/appendLlmAdoptAudit');

const LEGACY_SUNSET = 'Wed, 30 Sep 2026 00:00:00 GMT';
const LEGACY_SUCCESSOR = '/api/admin/llm/ops-explain';

function applyDeprecationHeaders(res, successorPath) {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', LEGACY_SUNSET);
  if (typeof successorPath === 'string' && successorPath.trim().length > 0) {
    res.setHeader('Link', `<${successorPath.trim()}>; rel="successor-version"`);
  }
}

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
  if (message.includes('required') || message.includes('invalid')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleOpsAssistAdopt(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await appendLlmAdoptAudit(payload);
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, auditId: result && result.id ? result.id : null }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleOpsAssistAdopt
};
