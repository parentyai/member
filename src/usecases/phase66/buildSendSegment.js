'use strict';

const { listOpsConsole } = require('../phase26/listOpsConsole');

const STATUS_VALUES = new Set(['READY', 'NOT_READY']);
const REDAC_STATUS_VALUES = new Set(['DECLARED', 'UNLINKED', 'NONE']);

function parseLineUserIds(value) {
  if (value === undefined || value === null) return null;
  let raw = null;
  if (Array.isArray(value)) {
    raw = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    raw = trimmed.split(/[\s,]+/);
  } else {
    return null;
  }

  const seen = new Set();
  const ids = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    ids.push(trimmed);
  }
  return ids.length > 0 ? ids : null;
}

function parseStatus(value) {
  if (value === undefined || value === null || value === '') return null;
  const status = String(value).trim().toUpperCase();
  if (!STATUS_VALUES.has(status)) throw new Error('invalid readinessStatus');
  return status;
}

function parseRedacStatus(value) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim().toUpperCase();
  if (!s || s === 'ANY') return null;
  if (!REDAC_STATUS_VALUES.has(s)) throw new Error('invalid redacStatus');
  return s;
}

function parseTriState(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === 'any') return null;
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false;
  throw new Error('invalid tri-state');
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

function matchHasMemberNumber(item, expected) {
  if (expected === null) return true;
  const flags = item && item.memberFlags && typeof item.memberFlags === 'object' ? item.memberFlags : {};
  return Boolean(flags.hasMemberNumber) === expected;
}

function matchRedacStatus(item, expected) {
  if (!expected) return true;
  const flags = item && item.memberFlags && typeof item.memberFlags === 'object' ? item.memberFlags : {};
  const status = typeof flags.redacStatus === 'string' ? flags.redacStatus : 'NONE';
  return status === expected;
}

async function buildSendSegment(params, deps) {
  const payload = params || {};
  const lineUserIds = parseLineUserIds(payload.lineUserIds);
  const limit = parseLimit(payload.limit);

  if (lineUserIds) {
    const limitedIds = limit ? lineUserIds.slice(0, limit) : lineUserIds;
    return {
      ok: true,
      serverTime: new Date().toISOString(),
      items: limitedIds.map((lineUserId) => ({
        lineUserId,
        readiness: null,
        recommendedNextAction: null,
        allowedNextActions: null,
        memberFlags: null
      }))
    };
  }

  const readinessStatus = parseStatus(payload.readinessStatus);
  const onlyNeedsAttention = parseBoolean(payload.needsAttention);
  const hasMemberNumber = parseTriState(payload.hasMemberNumber);
  const redacStatus = parseRedacStatus(payload.redacStatus);

  const listFn = deps && deps.listOpsConsole ? deps.listOpsConsole : listOpsConsole;
  const rawLimit = limit || 50;
  const overfetch = Math.max(rawLimit * 4, 200);
  const result = await listFn({
    status: readinessStatus || 'ALL',
    limit: overfetch
  }, deps);

  let items = Array.isArray(result.items) ? result.items : [];
  if (onlyNeedsAttention) {
    items = items.filter((item) => needsAttention(item));
  }
  items = items.filter((item) => matchHasMemberNumber(item, hasMemberNumber));
  items = items.filter((item) => matchRedacStatus(item, redacStatus));
  items = items.slice(0, rawLimit);

  const trimmed = items.map((item) => ({
    lineUserId: item.lineUserId,
    readiness: item.readiness,
    recommendedNextAction: item.recommendedNextAction,
    allowedNextActions: item.allowedNextActions,
    memberFlags: item.memberFlags || null
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
