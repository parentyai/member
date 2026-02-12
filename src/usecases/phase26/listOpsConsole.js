'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const { getOpsConsole } = require('../phase25/getOpsConsole');
const { encodeCursor, decodeCursor } = require('../../infra/cursorSigner');
const { signCursor, verifyCursor } = require('../../domain/cursorSigning');

const STATUS = new Set(['READY', 'NOT_READY', 'ALL']);
const READY_ACTIONS = ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'];
const NOT_READY_ACTIONS = ['STOP_AND_ESCALATE'];
const CURSOR_STATUSES = new Set(['READY', 'NOT_READY']);
const DEFAULT_CURSOR_SIGNING = Object.freeze({ secret: null, enforce: false, allowUnsigned: true });

function deriveMemberFlags(memberSummary) {
  const ms = memberSummary && typeof memberSummary === 'object' ? memberSummary : null;
  const member = ms && ms.member && typeof ms.member === 'object' ? ms.member : null;
  const redac = member && member.redac && typeof member.redac === 'object' ? member.redac : null;
  const hasMemberNumber = Boolean(member && member.hasMemberNumber === true);
  const memberNumberStale = Boolean(member && member.memberNumberStale === true);
  const redacLast4 = redac && typeof redac.redacMembershipIdLast4 === 'string' ? redac.redacMembershipIdLast4 : null;
  const hasRedac = Boolean(redac && redac.hasRedacMembership === true && redacLast4);
  const redacUnlinkedAt = redac && redac.redacMembershipUnlinkedAt ? String(redac.redacMembershipUnlinkedAt) : null;
  let redacStatus = 'NONE';
  if (hasRedac) redacStatus = 'DECLARED';
  else if (redacUnlinkedAt) redacStatus = 'UNLINKED';
  return {
    hasMemberNumber,
    memberNumberStale,
    redacStatus,
    redacMembershipIdLast4: redacLast4
  };
}

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

function parseBoolean(value) {
  if (value === true || value === false) return value;
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function resolveCursorSigning(deps) {
  const candidate = deps && typeof deps.cursorSecret === 'string'
    ? deps.cursorSecret
    : (process.env.OPS_CURSOR_HMAC_SECRET || process.env.OPS_CONSOLE_CURSOR_SECRET);
  const secret = typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
  const enforceCandidate = deps && Object.prototype.hasOwnProperty.call(deps, 'cursorEnforce')
    ? deps.cursorEnforce
    : (process.env.OPS_CURSOR_HMAC_ENFORCE || process.env.OPS_CONSOLE_CURSOR_ENFORCE);
  const enforce = parseBoolean(enforceCandidate);
  const allowUnsignedCandidate = deps && Object.prototype.hasOwnProperty.call(deps, 'allowUnsignedCursor')
    ? deps.allowUnsignedCursor
    : process.env.OPS_CURSOR_HMAC_ALLOW_UNSIGNED;
  const envName = process.env.ENV_NAME || 'local';
  const allowUnsignedDefault = envName === 'local'
    || process.env.NODE_ENV === 'test'
    || process.env.CI === 'true'
    || process.env.GITHUB_ACTIONS === 'true';
  const allowUnsigned = allowUnsignedCandidate === undefined
    ? allowUnsignedDefault
    : parseBoolean(allowUnsignedCandidate);
  return { secret, enforce, allowUnsigned };
}

function resolveSignedCursorSecret(deps) {
  const candidate = deps && typeof deps.cursorSigningSecret === 'string'
    ? deps.cursorSigningSecret
    : process.env.OPS_CURSOR_SIGNING_SECRET;
  const secret = typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
  const envName = process.env.ENV_NAME || 'local';
  const allowUnsigned = envName === 'local'
    || process.env.NODE_ENV === 'test'
    || process.env.CI === 'true'
    || process.env.GITHUB_ACTIONS === 'true';
  return { secret, allowUnsigned };
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

function normalizeExecutionStatus(value) {
  const payload = value && typeof value === 'object' ? value : {};
  const lastExecutionResult = typeof payload.lastExecutionResult === 'string'
    ? payload.lastExecutionResult
    : 'UNKNOWN';
  const lastExecutedAt = resolveTimestamp(payload.lastExecutedAt);
  return { lastExecutionResult, lastExecutedAt };
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
  const cursorSigning = resolveCursorSigning(deps);
  let cursorPayload = null;
  let cursor = null;
  if (payload.cursor !== undefined && payload.cursor !== null && payload.cursor !== '') {
    const cursorValue = String(payload.cursor);
    if (cursorValue.startsWith('v1.')) {
      cursorPayload = decodeCursor(cursorValue, cursorSigning);
      cursor = cursorPayload ? cursorPayload.lastSortKey : null;
    } else {
      const signedConfig = resolveSignedCursorSecret(deps);
      verifyCursor(cursorValue, signedConfig.secret, signedConfig.allowUnsigned);
    }
  }
  const cursorInfo = {
    mode: cursorSigning.secret ? 'SIGNED' : 'UNSIGNED',
    enforce: Boolean(cursorSigning.enforce)
  };

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
    const memberFlags = deriveMemberFlags(consoleResult ? consoleResult.memberSummary : null);
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
      memberFlags,
      opsState: consoleResult && consoleResult.opsState ? consoleResult.opsState : null,
      latestDecisionLog: consoleResult && consoleResult.latestDecisionLog ? consoleResult.latestDecisionLog : null,
      executionStatus: normalizeExecutionStatus(consoleResult ? consoleResult.executionStatus : null)
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
      rank: cursor.readinessRank,
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
  const signedConfig = resolveSignedCursorSecret(deps);
  const signedCursor = nextCursorCandidate
    ? signCursor(nextCursorCandidate, signedConfig.secret, signedConfig.allowUnsigned)
    : null;
  const nextCursor = hasNext && lastItem
    ? encodeCursor({
        lastSortKey: {
          readinessRank: readinessRank(lastItem.readiness.status),
          cursorCandidate: nextCursorCandidate,
          lineUserId: lastItem.lineUserId
        }
      }, cursorSigning)
    : null;

  return {
    ok: true,
    items: finalItems,
    serverTime: new Date().toISOString(),
    nextPageToken: nextCursor,
    pageInfo: {
      hasNext,
      nextCursor,
      cursorInfo
    },
    cursorInfo: {
      rawCursorCandidate: nextCursorCandidate || null,
      signedCursor: signedCursor || null,
      algo: 'HMAC-SHA256',
      hasNext: false
    }
  };
}

module.exports = {
  listOpsConsole
};
