'use strict';

const { getInbox } = require('../usecases/mini/getInbox');
const { getChecklist } = require('../usecases/mini/getChecklist');

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('not found')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleMiniInbox(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  try {
    const items = await getInbox({ lineUserId });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, items }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleMiniChecklist(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  try {
    const result = await getChecklist({ lineUserId });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, scenarioKey: result.scenarioKey, stepKey: result.stepKey, items: result.items }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleMiniInbox,
  handleMiniChecklist
};
