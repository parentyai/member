'use strict';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAllowList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .sort();
}

function collectLeafPaths(value, prefix, out) {
  const path = prefix || '';
  if (!isPlainObject(value)) {
    if (path) out.push(path);
    return;
  }
  const keys = Object.keys(value);
  if (!keys.length) {
    if (path) out.push(path);
    return;
  }
  keys.forEach((key) => {
    const next = path ? `${path}.${key}` : key;
    collectLeafPaths(value[key], next, out);
  });
}

function isAllowedPath(path, allowList) {
  return allowList.some((allowed) => path === allowed || path.startsWith(`${allowed}.`));
}

function getValueAtPath(input, path) {
  if (!path) return undefined;
  const parts = path.split('.');
  let cursor = input;
  for (const part of parts) {
    if (!isPlainObject(cursor) && !Array.isArray(cursor)) return undefined;
    if (cursor === null || cursor === undefined) return undefined;
    cursor = cursor[part];
    if (cursor === undefined) return undefined;
  }
  return cursor;
}

function setValueAtPath(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  parts.forEach((part, idx) => {
    if (idx === parts.length - 1) {
      cursor[part] = value;
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(cursor, part) || !isPlainObject(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  });
}

function sanitizeInput(params) {
  const payload = params || {};
  const input = payload.input;
  const allowList = normalizeAllowList(payload.allowList);
  if (!isPlainObject(input)) {
    return { ok: false, reason: 'invalid_input', blockedPaths: [] };
  }
  const paths = [];
  collectLeafPaths(input, '', paths);
  const blockedPaths = paths.filter((path) => !isAllowedPath(path, allowList));
  if (blockedPaths.length) {
    return { ok: false, reason: 'allow_list_violation', blockedPaths };
  }
  const filtered = {};
  allowList.forEach((path) => {
    const value = getValueAtPath(input, path);
    if (value !== undefined) {
      setValueAtPath(filtered, path, value);
    }
  });
  return { ok: true, data: filtered, blockedPaths: [] };
}

const DEFAULT_ALLOW_LISTS = Object.freeze({
  opsExplanation: [
    'readiness.status',
    'readiness.blocking',
    'blockingReasons',
    'riskLevel',
    'notificationHealthSummary.totalNotifications',
    'notificationHealthSummary.countsByHealth',
    'notificationHealthSummary.unhealthyCount',
    'mitigationSuggestion',
    'allowedNextActions',
    'recommendedNextAction',
    'executionStatus.lastExecutionResult',
    'executionStatus.lastFailureClass',
    'executionStatus.lastReasonCode',
    'executionStatus.lastStage',
    'decisionDrift.status',
    'decisionDrift.types',
    'closeDecision',
    'closeReason',
    'phaseResult',
    'lastReactionAt',
    'dangerFlags.notReady',
    'dangerFlags.staleMemberNumber'
  ],
  nextActionCandidates: [
    'readiness.status',
    'readiness.blocking',
    'opsState.nextAction',
    'opsState.failure_class',
    'opsState.reasonCode',
    'opsState.stage',
    'latestDecisionLog.nextAction',
    'latestDecisionLog.createdAt',
    'constraints.allowedNextActions',
    'constraints.readiness'
  ],
  faqAnswer: [
    'question',
    'sourceIds'
  ]
});

module.exports = {
  DEFAULT_ALLOW_LISTS,
  normalizeAllowList,
  sanitizeInput
};
