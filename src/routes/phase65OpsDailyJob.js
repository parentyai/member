'use strict';

const { generateOpsDailyReport } = require('../usecases/phase62/generateOpsDailyReport');

function getHeader(req, name) {
  if (!req || !req.headers) return null;
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
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

async function handleOpsDailyJob(req, res, deps) {
  const envToken = process.env.OPS_JOB_TOKEN;
  if (!envToken || String(envToken).trim().length === 0) {
    res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'job token required' }));
    return;
  }
  const headerToken = getHeader(req, 'x-ops-job-token');
  if (!headerToken || headerToken !== envToken) {
    res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid token' }));
    return;
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const date = url.searchParams.get('date');
    const generateFn = deps && deps.generateOpsDailyReport ? deps.generateOpsDailyReport : generateOpsDailyReport;
    const result = await generateFn({ date });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleOpsDailyJob
};
