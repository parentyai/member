'use strict';

const {
  appendDecision,
  getLatestDecision,
  listDecisions
} = require('../usecases/phase24/decisionLogs');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function parseQuery(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    return Object.fromEntries(url.searchParams.entries());
  } catch (err) {
    return {};
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

async function handleAppendDecisionLog(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await appendDecision(payload);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, id: result.id }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleLatestDecision(req, res) {
  const query = parseQuery(req);
  try {
    const decision = await getLatestDecision(query.subjectType, query.subjectId);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, decision }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleListDecisions(req, res) {
  const query = parseQuery(req);
  try {
    const decisions = await listDecisions(query.subjectType, query.subjectId, query.limit);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, decisions }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleAppendDecisionLog,
  handleLatestDecision,
  handleListDecisions
};
