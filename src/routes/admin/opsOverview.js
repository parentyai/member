'use strict';

const { getUserOperationalSummary } = require('../../usecases/admin/getUserOperationalSummary');
const { getNotificationOperationalSummary } = require('../../usecases/admin/getNotificationOperationalSummary');

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid limit') || message.includes('invalid snapshotMode')) {
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

function parseSnapshotMode(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value === 'prefer' || value === 'require') return value;
  return null;
}

async function handleUsersSummary(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const limitRaw = url.searchParams.get('limit');
    const analyticsLimitRaw = url.searchParams.get('analyticsLimit');
    const snapshotModeRaw = url.searchParams.get('snapshotMode');
    const limit = parsePositiveInt(limitRaw, 1, 500);
    const analyticsLimit = parsePositiveInt(analyticsLimitRaw, 1, 3000);
    const snapshotMode = parseSnapshotMode(snapshotModeRaw);
    if ((limitRaw && !limit) || (analyticsLimitRaw && !analyticsLimit)) {
      throw new Error('invalid limit');
    }
    if (snapshotModeRaw && !snapshotMode) {
      throw new Error('invalid snapshotMode');
    }
    const items = await getUserOperationalSummary({
      limit,
      analyticsLimit,
      snapshotMode,
      includeMeta: true
    });
    const normalizedItems = Array.isArray(items) ? items : (Array.isArray(items.items) ? items.items : []);
    const meta = items && !Array.isArray(items) && items.meta ? items.meta : null;
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      items: normalizedItems,
      dataSource: meta && meta.dataSource ? meta.dataSource : null,
      asOf: meta && Object.prototype.hasOwnProperty.call(meta, 'asOf') ? meta.asOf : null,
      freshnessMinutes: meta && Object.prototype.hasOwnProperty.call(meta, 'freshnessMinutes') ? meta.freshnessMinutes : null
    }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleNotificationsSummary(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const limitRaw = url.searchParams.get('limit');
  const eventsLimitRaw = url.searchParams.get('eventsLimit');
  const snapshotModeRaw = url.searchParams.get('snapshotMode');
  const status = url.searchParams.get('status');
  const scenarioKey = url.searchParams.get('scenarioKey');
  const stepKey = url.searchParams.get('stepKey');
  try {
    const limit = parsePositiveInt(limitRaw, 1, 500);
    const eventsLimit = parsePositiveInt(eventsLimitRaw, 1, 3000);
    const snapshotMode = parseSnapshotMode(snapshotModeRaw);
    if ((limitRaw && !limit) || (eventsLimitRaw && !eventsLimit)) {
      throw new Error('invalid limit');
    }
    if (snapshotModeRaw && !snapshotMode) {
      throw new Error('invalid snapshotMode');
    }
    const summary = await getNotificationOperationalSummary({
      limit,
      eventsLimit,
      snapshotMode,
      includeMeta: true,
      status: status || undefined,
      scenarioKey: scenarioKey || undefined,
      stepKey: stepKey || undefined
    });
    const items = Array.isArray(summary) ? summary : (Array.isArray(summary.items) ? summary.items : []);
    const meta = summary && !Array.isArray(summary) && summary.meta ? summary.meta : null;
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      items,
      dataSource: meta && meta.dataSource ? meta.dataSource : null,
      asOf: meta && Object.prototype.hasOwnProperty.call(meta, 'asOf') ? meta.asOf : null,
      freshnessMinutes: meta && Object.prototype.hasOwnProperty.call(meta, 'freshnessMinutes') ? meta.freshnessMinutes : null
    }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleUsersSummary,
  handleNotificationsSummary
};
