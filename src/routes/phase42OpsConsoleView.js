'use strict';

const { getOpsConsoleView } = require('../usecases/phase42/getOpsConsoleView');

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

async function handleOpsConsoleView(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  const notificationId = url.searchParams.get('notificationId');
  if (!lineUserId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId required' }));
    return;
  }
  try {
    const result = await getOpsConsoleView({ lineUserId, notificationId });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleOpsConsoleView
};
