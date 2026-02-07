'use strict';

const { recordOpsNextAction } = require('../usecases/phase24/recordOpsNextAction');
const opsStatesRepo = require('../repos/firestore/opsStatesRepo');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleUpsertOpsState(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await recordOpsNextAction(payload);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, decisionLogId: result.decisionLogId, opsState: result.opsState }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleGetOpsState(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  if (!lineUserId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId required' }));
    return;
  }
  try {
    const opsState = await opsStatesRepo.getOpsState(lineUserId);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, opsState }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleUpsertOpsState,
  handleGetOpsState
};
