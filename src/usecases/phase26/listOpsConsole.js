'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const { getOpsConsole } = require('../phase25/getOpsConsole');

const STATUS = new Set(['READY', 'NOT_READY', 'ALL']);
const READY_ACTIONS = ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'];
const NOT_READY_ACTIONS = ['STOP_AND_ESCALATE'];
const CURSOR_STATUSES = new Set(['READY', 'NOT_READY']);

function parseStatus(value) {
  if (value === undefined || value === null || value === '') return 'ALL';
  const status = String(value).trim().toUpperCase();
  if (!STATUS.has(status)) throw new Error('invalid status');
  return status;
}

function parseLimit(value) {
  if (value === undefined || value === null || value === '') return 50;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new Error('invalid limit');
  return Math.floor(num);
}

function extractLineUserId(user) {
  if (!user) return null;
  if (typeof user.id === 'string' && user.id.trim().length > 0) return user.id;
  if (typeof user.lineUserId === 'string' && user.lineUserId.trim().length > 0) return user.lineUserId;
  return null;
}

function normalizeReadinessStatus(readiness) {
  if (readiness && typeof readiness.status === 'string' && readiness.status.trim().length > 0) {
    return readiness.status;
  }
  return 'NOT_READY';
}

function parseCursor(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('invalid cursor');
  let payload;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    payload = JSON.parse(decoded);
  } catch (err) {
    throw new Error('invalid cursor');
  }
  if (!payload || typeof payload !== 'object') throw new Error('invalid cursor');
  const status = typeof payload.s === 'string' ? payload.s : '';
  const lineUserId = typeof payload.id === 'string' ? payload.id.trim() : '';
  if (!CURSOR_STATUSES.has(status)) throw new Error('invalid cursor');
  if (!lineUserId) throw new Error('invalid cursor');
  const cursorCandidate = payload.t === null ? null : payload.t;
  if (cursorCandidate !== null) {
    if (typeof cursorCandidate !== 'string') throw new Error('invalid cursor');
    const date = new Date(cursorCandidate);
    if (Number.isNaN(date.getTime())) throw new Error('invalid cursor');
  }
  return {
    status,
    cursorCandidate,
    lineUserId
  };
}

function encodeCursor(payload) {
  if (!payload) return null;
  const json = JSON.stringify({
    s: payload.status,
    t: payload.cursorCandidate || null,
    id: payload.lineUserId
  });
  return Buffer.from(json, 'utf8').toString('base64url');
}

function normalizeReadiness(readiness) {
  const status = normalizeReadinessStatus(readiness);
  const blocking = readiness && Array.isArray(readiness.blocking) ? readiness.blocking : [];
  return { status: status === 'READY' ? 'READY' : 'NOT_READY', blocking };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
}

function normalizeRecommendedNextAction(value, readinessStatus) {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return readinessStatus === 'READY' ? 'NO_ACTION' : 'STOP_AND_ESCALATE';
}

function normalizeAllowedNextActions(value, readinessStatus) {
  const sanitized = normalizeStringArray(value);
  if (sanitized.length) return sanitized;
  return readinessStatus === 'READY' ? READY_ACTIONS.slice() : NOT_READY_ACTIONS.slice();
}

function readinessRank(status) {
  return status === 'READY' ? 0 : 1;
}

function buildSortKey(item) {
  const readiness = item && item.readiness ? item.readiness : null;
  const status = readiness && readiness.status ? readiness.status : 'NOT_READY';
  return {
    rank: readinessRank(status),
    cursorCandidate: extractCursorCandidate(item),
    lineUserId: item ? item.lineUserId : ''
  };
}

function resolveTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function extractCursorCandidate(item) {
  if (!item) return null;
  const opsState = item.opsState || null;
  const latestDecisionLog = item.latestDecisionLog || null;
  const opsUpdatedAt = resolveTimestamp(opsState && opsState.updatedAt);
  if (opsUpdatedAt) return opsUpdatedAt;
  const decidedAt = resolveTimestamp(latestDecisionLog && latestDecisionLog.decidedAt);
  if (decidedAt) return decidedAt;
  return resolveTimestamp(latestDecisionLog && latestDecisionLog.createdAt);
}

function compareIsoDesc(left, right) {
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left > right ? -1 : 1;
}

function compareSortKeys(left, right) {
  if (left.rank !== right.rank) return left.rank - right.rank;
  const cursorCmp = compareIsoDesc(left.cursorCandidate, right.cursorCandidate);
  if (cursorCmp !== 0) return cursorCmp;
  return left.lineUserId.localeCompare(right.lineUserId);
}

async function listOpsConsole(params, deps) {
  const payload = params || {};
  const status = parseStatus(payload.status);
  const limit = parseLimit(payload.limit);
  const cursor = parseCursor(payload.cursor);

  const listUsersFn = deps && deps.listUsers ? deps.listUsers : usersRepo.listUsers;
  const getOpsConsoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;

  const fetchLimit = Math.max(limit + 1, limit * 2);
  const users = await listUsersFn({ limit: fetchLimit });
  const items = [];

  for (const user of users || []) {
    const lineUserId = extractLineUserId(user);
    if (!lineUserId) continue;
    const consoleResult = await getOpsConsoleFn({ lineUserId }, deps);
    const readiness = normalizeReadiness(consoleResult ? consoleResult.readiness : null);
    const readinessStatus = readiness.status;
    if (status !== 'ALL' && readinessStatus !== status) continue;
    items.push({
      lineUserId,
      readiness,
      recommendedNextAction: normalizeRecommendedNextAction(
        consoleResult ? consoleResult.recommendedNextAction : null,
        readinessStatus
      ),
      allowedNextActions: normalizeAllowedNextActions(
        consoleResult ? consoleResult.allowedNextActions : null,
        readinessStatus
      ),
      opsState: consoleResult && consoleResult.opsState ? consoleResult.opsState : null,
      latestDecisionLog: consoleResult && consoleResult.latestDecisionLog ? consoleResult.latestDecisionLog : null
    });
  }

  const sorted = items.map((item) => ({
    item,
    key: buildSortKey(item)
  }));
  sorted.sort((left, right) => compareSortKeys(left.key, right.key));

  let filtered = sorted;
  if (cursor) {
    const cursorKey = {
      rank: readinessRank(cursor.status),
      cursorCandidate: cursor.cursorCandidate,
      lineUserId: cursor.lineUserId
    };
    filtered = sorted.filter((entry) => compareSortKeys(entry.key, cursorKey) > 0);
  }

  const hasNext = filtered.length > limit;
  const pageEntries = filtered.slice(0, limit);
  const finalItems = pageEntries.map((entry) => entry.item);
  const lastItem = finalItems.length ? finalItems[finalItems.length - 1] : null;
  // Placeholder: compute cursor candidate for future pagination expansion.
  const nextCursorCandidate = extractCursorCandidate(lastItem);
  const nextCursor = hasNext && lastItem
    ? encodeCursor({
        status: lastItem.readiness.status,
        cursorCandidate: nextCursorCandidate,
        lineUserId: lastItem.lineUserId
      })
    : null;

  return {
    ok: true,
    items: finalItems,
    serverTime: new Date().toISOString(),
    nextPageToken: nextCursor,
    pageInfo: {
      hasNext,
      nextCursor
    }
  };
}

module.exports = {
  listOpsConsole
};
