'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');

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

function isMemberNumberMissing(user) {
  const value = user && user.memberNumber;
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

async function getStaleMemberNumberUsers(params) {
  const payload = params || {};
  const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();
  const users = await usersRepo.listUsers({ limit: payload.limit });
  const items = [];
  for (const user of users) {
    if (!isMemberNumberMissing(user)) continue;
    const createdMs = toMillis(user.createdAt);
    if (!createdMs) continue;
    const diffMs = nowMs - createdMs;
    if (diffMs < STALE_DAYS * DAY_MS) continue;
    const daysSinceCreated = Math.floor(diffMs / DAY_MS);
    items.push({
      lineUserId: user.id,
      createdAt: user.createdAt || null,
      daysSinceCreated
    });
  }
  return { count: items.length, items };
}

module.exports = {
  getStaleMemberNumberUsers,
  STALE_DAYS
};
