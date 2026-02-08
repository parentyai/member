'use strict';

const automationRunsRepo = require('../repos/firestore/automationRunsRepo');

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleRunStatus(req, res, runId, deps) {
  if (!runId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'runId required' }));
    return;
  }
  try {
    const repo = deps && deps.automationRunsRepo ? deps.automationRunsRepo : automationRunsRepo;
    const run = await repo.getRun(runId);
    if (!run) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'run not found' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      run: {
        id: run.id,
        status: run.status || null,
        counters: run.counters || null,
        limits: run.limits || null,
        updatedAt: run.updatedAt || null,
        lastError: run.lastError || null
      }
    }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleRunStatus
};
