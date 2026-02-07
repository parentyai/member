'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const { evaluateUserSummaryCompleteness } = require('../phase24/userSummaryCompleteness');
const { evaluateRegistrationCompleteness } = require('../phase24/registrationCompleteness');

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function hasMemberNumber(user) {
  return Boolean(user && typeof user.memberNumber === 'string' && user.memberNumber.trim().length > 0);
}

function maskMemberNumber(memberNumber) {
  const value = String(memberNumber).trim();
  if (value.length < 4) return '****';
  return `****${value.slice(-4)}`;
}

function isMemberNumberStale(user, nowMs) {
  if (hasMemberNumber(user)) return false;
  const createdAtMs = toMillis(user && user.createdAt);
  if (!createdAtMs) return false;
  return nowMs - createdAtMs >= STALE_DAYS * DAY_MS;
}

async function getMemberSummary(params) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  const user = await usersRepo.getUser(lineUserId);
  if (!user) return null;

  const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();
  const hasNumber = hasMemberNumber(user);
  const stale = isMemberNumberStale(user, nowMs);

  const summary = {
    ok: true,
    lineUserId,
    member: {
      hasMemberNumber: hasNumber,
      memberNumberMasked: hasNumber ? maskMemberNumber(user.memberNumber) : null,
      memberNumberStale: stale
    },
    ops: {
      needsAttention: false,
      reasonCodes: []
    },
    meta: {
      source: 'phase5-derived',
      generatedAt: new Date(nowMs).toISOString()
    }
  };

  summary.completeness = evaluateUserSummaryCompleteness(summary);
  summary.registrationCompleteness = await evaluateRegistrationCompleteness(user, {
    listUsersByMemberNumber: usersRepo.listUsersByMemberNumber
  });
  return summary;
}

module.exports = {
  getMemberSummary
};
