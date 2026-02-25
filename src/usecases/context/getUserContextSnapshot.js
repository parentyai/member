'use strict';

const userContextSnapshotsRepo = require('../../repos/firestore/userContextSnapshotsRepo');

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    if (parsed instanceof Date && Number.isFinite(parsed.getTime())) return parsed.getTime();
  }
  return null;
}

function resolveMaxAgeHours(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return 24 * 30;
  return Math.min(Math.floor(raw), 24 * 365);
}

async function getUserContextSnapshot(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
  if (!lineUserId) {
    return {
      ok: false,
      reason: 'lineUserId_required',
      lineUserId: ''
    };
  }

  const repo = deps && deps.userContextSnapshotsRepo
    ? deps.userContextSnapshotsRepo
    : userContextSnapshotsRepo;
  const snapshot = await repo.getUserContextSnapshot(lineUserId);
  if (!snapshot) {
    return {
      ok: false,
      reason: 'snapshot_not_found',
      lineUserId
    };
  }

  const updatedAtMs = toMillis(snapshot.updatedAt);
  const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();
  const ageHours = updatedAtMs && Number.isFinite(updatedAtMs)
    ? Math.max(0, Math.floor((nowMs - updatedAtMs) / (60 * 60 * 1000)))
    : null;
  const maxAgeHours = resolveMaxAgeHours(payload.maxAgeHours);

  return {
    ok: true,
    lineUserId,
    snapshot,
    ageHours,
    stale: Number.isFinite(ageHours) ? ageHours > maxAgeHours : true,
    maxAgeHours
  };
}

module.exports = {
  getUserContextSnapshot
};
