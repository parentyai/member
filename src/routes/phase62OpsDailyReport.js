'use strict';

const { generateOpsDailyReport } = require('../usecases/phase62/generateOpsDailyReport');

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

async function handleOpsDailyReport(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const date = url.searchParams.get('date');
    const result = await generateOpsDailyReport({ date });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleOpsDailyReport
};
