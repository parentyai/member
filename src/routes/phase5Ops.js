'use strict';

const { getUsersSummaryFiltered } = require('../usecases/phase5/getUsersSummaryFiltered');
const { getNotificationsSummaryFiltered } = require('../usecases/phase5/getNotificationsSummaryFiltered');
const { getStaleMemberNumberUsers } = require('../usecases/phase5/getStaleMemberNumberUsers');

function parseDateParam(value, endOfDay) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date.getTime();
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('invalid date')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

function parseRange(url) {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const fromMs = parseDateParam(from, false);
  const toMs = parseDateParam(to, true);
  if ((from && !fromMs) || (to && !toMs)) {
    throw new Error('invalid date');
  }
  return { fromMs, toMs };
}

async function handleUsersSummaryFiltered(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const range = parseRange(url);
    const items = await getUsersSummaryFiltered(range);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, items }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleNotificationsSummaryFiltered(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const range = parseRange(url);
    const items = await getNotificationsSummaryFiltered(range);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, items }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleStaleMemberNumber(req, res) {
  try {
    const result = await getStaleMemberNumberUsers();
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, count: result.count, items: result.items }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleUsersSummaryFiltered,
  handleNotificationsSummaryFiltered,
  handleStaleMemberNumber
};
