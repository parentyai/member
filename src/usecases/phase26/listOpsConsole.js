'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const { getOpsConsole } = require('../phase25/getOpsConsole');

const STATUS = new Set(['READY', 'NOT_READY', 'ALL']);
const READY_ACTIONS = ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'];
const NOT_READY_ACTIONS = ['STOP_AND_ESCALATE'];

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

async function listOpsConsole(params, deps) {
  const payload = params || {};
  const status = parseStatus(payload.status);
  const limit = parseLimit(payload.limit);

  const listUsersFn = deps && deps.listUsers ? deps.listUsers : usersRepo.listUsers;
  const getOpsConsoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;

  const users = await listUsersFn({ limit });
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
    rank: readinessRank(item.readiness.status),
    cursorCandidate: extractCursorCandidate(item)
  }));
  sorted.sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    const cursorCmp = compareIsoDesc(left.cursorCandidate, right.cursorCandidate);
    if (cursorCmp !== 0) return cursorCmp;
    return left.item.lineUserId.localeCompare(right.item.lineUserId);
  });
  const finalItems = sorted.map((entry) => entry.item);

  const lastItem = finalItems.length ? finalItems[finalItems.length - 1] : null;
  // Placeholder: compute cursor candidate for future pagination expansion.
  const nextCursorCandidate = extractCursorCandidate(lastItem);
  void nextCursorCandidate;

  return {
    ok: true,
    items: finalItems,
    serverTime: new Date().toISOString(),
    nextPageToken: null,
    pageInfo: {
      hasNext: false,
      nextCursor: null
    }
  };
}

module.exports = {
  listOpsConsole
};
