'use strict';

const { listOpsConsole } = require('../phase26/listOpsConsole');

const STATUS_VALUES = new Set(['READY', 'NOT_READY']);

function parseStatus(value) {
  if (value === undefined || value === null || value === '') return null;
  const status = String(value).trim().toUpperCase();
  if (!STATUS_VALUES.has(status)) throw new Error('invalid readinessStatus');
  return status;
}

function parseBoolean(value) {
  if (value === true || value === false) return value;
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseLimit(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new Error('invalid limit');
  return Math.floor(num);
}

function needsAttention(item) {
  if (!item || !item.readiness) return true;
  if (item.readiness.status !== 'READY') return true;
  const blocking = Array.isArray(item.readiness.blocking) ? item.readiness.blocking : [];
  return blocking.length > 0;
}

async function buildSendSegment(params, deps) {
  const payload = params || {};
  const readinessStatus = parseStatus(payload.readinessStatus);
  const onlyNeedsAttention = parseBoolean(payload.needsAttention);
  const limit = parseLimit(payload.limit);

  const listFn = deps && deps.listOpsConsole ? deps.listOpsConsole : listOpsConsole;
  const result = await listFn({
    status: readinessStatus || 'ALL',
    limit: limit || 50
  }, deps);

  let items = Array.isArray(result.items) ? result.items : [];
  if (onlyNeedsAttention) {
    items = items.filter((item) => needsAttention(item));
  }

  const trimmed = items.map((item) => ({
    lineUserId: item.lineUserId,
    readiness: item.readiness,
    recommendedNextAction: item.recommendedNextAction,
    allowedNextActions: item.allowedNextActions
  }));

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    items: trimmed
  };
}

module.exports = {
  buildSendSegment
};
