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

  return {
    ok: true,
    items,
    serverTime: new Date().toISOString(),
    nextPageToken: null
  };
}

module.exports = {
  listOpsConsole
};
