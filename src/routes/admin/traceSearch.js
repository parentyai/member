'use strict';

const { getTraceBundle } = require('../../usecases/admin/getTraceBundle');

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

async function handleAdminTraceSearch(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const traceId = url.searchParams.get('traceId');
  const limit = url.searchParams.get('limit');
  try {
    const result = await getTraceBundle({ traceId, limit });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleAdminTraceSearch
};

