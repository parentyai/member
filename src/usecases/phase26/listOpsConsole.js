'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const { getOpsConsole } = require('../phase25/getOpsConsole');

const STATUS = new Set(['READY', 'NOT_READY', 'ALL']);

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
    const readiness = consoleResult ? consoleResult.readiness : null;
    const readinessStatus = normalizeReadinessStatus(readiness);
    if (status !== 'ALL' && readinessStatus !== status) continue;
    items.push({
      lineUserId,
      readiness,
      recommendedNextAction: consoleResult ? consoleResult.recommendedNextAction : null,
      allowedNextActions: consoleResult && Array.isArray(consoleResult.allowedNextActions)
        ? consoleResult.allowedNextActions
        : [],
      opsState: consoleResult ? consoleResult.opsState : null,
      latestDecisionLog: consoleResult ? consoleResult.latestDecisionLog : null
    });
  }

  const lastItem = items.length ? items[items.length - 1] : null;
  // Placeholder: compute cursor candidate for future pagination expansion.
  const nextCursorCandidate = extractCursorCandidate(lastItem);
  void nextCursorCandidate;

  return {
    ok: true,
    items,
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
