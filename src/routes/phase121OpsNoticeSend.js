'use strict';

const { sendOpsNotice } = require('../usecases/phase121/sendOpsNotice');

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

async function handleOpsNoticeSend(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await sendOpsNotice(payload);
    if (result && result.status === 409) {
      res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleOpsNoticeSend
};
