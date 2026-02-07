'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');

const SEVERITY_ORDER = {
  OK: 0,
  WARN: 1,
  BLOCK: 2
};

const MISSING_SEVERITY = {
  missing_line_user_id: 'BLOCK',
  missing_member_number: 'BLOCK',
  member_number_invalid_format: 'WARN',
  duplicate_member_number: 'BLOCK'
};

function maxSeverity(current, next) {
  if (SEVERITY_ORDER[next] > SEVERITY_ORDER[current]) return next;
  return current;
}

function normalizeMemberNumber(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function getUserData(user) {
  if (!user) return { lineUserId: null, memberNumber: null };
  const data = user.data || user;
  const lineUserId = user.id || data.lineUserId || null;
  return { lineUserId, memberNumber: data.memberNumber };
}

function isInvalidFormat(value) {
  if (typeof value !== 'string') return false;
  if (value.trim().length === 0) return false;
  if (value !== value.trim()) return true;
  return /\s/.test(value);
}

async function countDuplicatesByMemberNumber(memberNumber, deps) {
  const normalized = normalizeMemberNumber(memberNumber);
  if (!normalized) return 0;
  const allUsers = deps && Array.isArray(deps.allUsers) ? deps.allUsers : null;
  if (allUsers) {
    return allUsers.filter((entry) => {
      const data = entry && entry.data ? entry.data : entry;
      return normalizeMemberNumber(data && data.memberNumber) === normalized;
    }).length;
  }
  const listFn = deps && typeof deps.listUsersByMemberNumber === 'function'
    ? deps.listUsersByMemberNumber
    : usersRepo.listUsersByMemberNumber;
  if (!listFn) return 0;
  const users = await listFn(normalized);
  return Array.isArray(users) ? users.length : 0;
}

async function evaluateRegistrationCompleteness(user, deps) {
  const { lineUserId, memberNumber } = getUserData(user);
  const missing = [];

  if (!lineUserId) {
    missing.push('missing_line_user_id');
  }

  const normalized = normalizeMemberNumber(memberNumber);
  if (!normalized) {
    missing.push('missing_member_number');
  } else if (isInvalidFormat(memberNumber)) {
    missing.push('member_number_invalid_format');
  }

  if (normalized) {
    const count = await countDuplicatesByMemberNumber(normalized, deps);
    if (count > 1) {
      missing.push('duplicate_member_number');
    }
  }

  let severity = 'OK';
  let hasBlock = false;
  missing.forEach((code) => {
    const next = MISSING_SEVERITY[code] || 'WARN';
    severity = maxSeverity(severity, next);
    if (next === 'BLOCK') hasBlock = true;
  });

  const ok = !hasBlock;
  const needsAttention = missing.length > 0;

  return {
    ok,
    missing,
    needsAttention,
    severity,
    reasons: missing.slice()
  };
}

module.exports = {
  evaluateRegistrationCompleteness
};
