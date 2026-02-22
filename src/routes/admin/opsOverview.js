'use strict';

const { getUserOperationalSummary } = require('../../usecases/admin/getUserOperationalSummary');
const { getNotificationOperationalSummary } = require('../../usecases/admin/getNotificationOperationalSummary');

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid limit')) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(message);
    return;
  }
  res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('error');
}

function parsePositiveInt(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

async function handleUsersSummary(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const limitRaw = url.searchParams.get('limit');
    const analyticsLimitRaw = url.searchParams.get('analyticsLimit');
    const limit = parsePositiveInt(limitRaw, 1, 500);
    const analyticsLimit = parsePositiveInt(analyticsLimitRaw, 1, 3000);
    if ((limitRaw && !limit) || (analyticsLimitRaw && !analyticsLimit)) {
      throw new Error('invalid limit');
    }
    const items = await getUserOperationalSummary({
      limit,
      analyticsLimit
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, items }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleNotificationsSummary(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const limitRaw = url.searchParams.get('limit');
  const eventsLimitRaw = url.searchParams.get('eventsLimit');
  const status = url.searchParams.get('status');
  const scenarioKey = url.searchParams.get('scenarioKey');
  const stepKey = url.searchParams.get('stepKey');
  try {
    const limit = parsePositiveInt(limitRaw, 1, 500);
    const eventsLimit = parsePositiveInt(eventsLimitRaw, 1, 3000);
    if ((limitRaw && !limit) || (eventsLimitRaw && !eventsLimit)) {
      throw new Error('invalid limit');
    }
    const items = await getNotificationOperationalSummary({
      limit,
      eventsLimit,
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
