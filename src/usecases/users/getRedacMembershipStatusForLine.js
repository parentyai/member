'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');

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

function deriveStatus(user) {
  const last4 = typeof user.redacMembershipIdLast4 === 'string' ? user.redacMembershipIdLast4 : null;
  const has = Boolean(last4);
  const unlinkedAt = resolveTimestamp(user.redacMembershipUnlinkedAt);
  if (has && last4) return { status: 'DECLARED', last4 };
  if (!has && unlinkedAt) return { status: 'UNLINKED', last4: null };
  return { status: 'NONE', last4: null };
}

async function getRedacMembershipStatusForLine(params) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0
    ? payload.requestId.trim()
    : 'unknown';
  if (!lineUserId) throw new Error('lineUserId required');

  const user = await usersRepo.getUser(lineUserId);
  if (!user) {
    // Should not happen (ensureUser runs in webhook), but keep deterministic.
    return { ok: true, status: 'NONE', last4: null };
  }

  const derived = deriveStatus(user);

  try {
    await appendAuditLog({
      actor: 'line',
      action: 'redac_membership.status_view',
      entityType: 'user',
      entityId: lineUserId,
      traceId: requestId,
      requestId,
      payloadSummary: {
        ok: true,
        status: derived.status,
        redacMembershipIdLast4: derived.last4
      }
    });
  } catch (_err) {
    // best-effort only
  }

  return { ok: true, status: derived.status, last4: derived.last4 };
}

module.exports = {
  getRedacMembershipStatusForLine
};

