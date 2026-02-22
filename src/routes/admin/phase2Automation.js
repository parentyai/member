'use strict';

const { runPhase2Automation } = require('../../usecases/phase2/runAutomation');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

async function handleRunPhase2(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const fallbackMode = payload && typeof payload.fallbackMode === 'string'
    ? payload.fallbackMode.trim().toLowerCase()
    : '';
  if (fallbackMode && fallbackMode !== 'allow' && fallbackMode !== 'block') {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid fallbackMode' }));
    return;
  }
  const result = await runPhase2Automation({
    runId: payload.runId,
    targetDate: payload.targetDate,
    dryRun: payload.dryRun,
    analyticsLimit: payload.analyticsLimit,
    fallbackMode: fallbackMode || undefined,
    logger: (msg) => console.log(msg)
  });
  if (!result.ok) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: result.error }));
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, summary: result.summary }));
}

module.exports = {
  handleRunPhase2
};
