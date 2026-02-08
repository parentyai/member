'use strict';

const { listOpsConsole } = require('../usecases/phase26/listOpsConsole');

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

async function handleOpsConsoleList(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const status = url.searchParams.get('status');
  const limit = url.searchParams.get('limit');
  const cursor = url.searchParams.get('cursor');
  try {
    const result = await listOpsConsole({ status, limit, cursor });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleOpsConsoleList
};
