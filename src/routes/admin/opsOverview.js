'use strict';

const { getUserOperationalSummary } = require('../../usecases/admin/getUserOperationalSummary');
const { getNotificationOperationalSummary } = require('../../usecases/admin/getNotificationOperationalSummary');

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required')) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(message);
    return;
  }
  res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('error');
}

async function handleUsersSummary(req, res) {
  try {
    const items = await getUserOperationalSummary();
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, items }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleNotificationsSummary(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const limit = url.searchParams.get('limit');
  const status = url.searchParams.get('status');
  const scenarioKey = url.searchParams.get('scenarioKey');
  const stepKey = url.searchParams.get('stepKey');
  try {
    const items = await getNotificationOperationalSummary({
      limit: limit ? Number(limit) : undefined,
      status: status || undefined,
      scenarioKey: scenarioKey || undefined,
      stepKey: stepKey || undefined
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, items }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleUsersSummary,
  handleNotificationsSummary
};
