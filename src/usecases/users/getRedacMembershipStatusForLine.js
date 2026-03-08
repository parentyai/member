'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const {
  resolveRedacMembershipFromRecord,
  logCanonicalAuthorityLegacyRead
} = require('../../domain/canonicalAuthority');

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
  const resolved = resolveRedacMembershipFromRecord(user);
  const last4 = resolved.last4;
  const has = Boolean(last4);
  const unlinkedAt = resolveTimestamp(user.redacMembershipUnlinkedAt);
  if (has && last4) return { status: 'DECLARED', last4, authoritySource: resolved.source, legacyReadUsed: resolved.legacyReadUsed };
  if (!has && unlinkedAt) return { status: 'UNLINKED', last4: null, authoritySource: resolved.source, legacyReadUsed: resolved.legacyReadUsed };
  return { status: 'NONE', last4: null, authoritySource: resolved.source, legacyReadUsed: resolved.legacyReadUsed };
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
  if (derived.legacyReadUsed) {
    logCanonicalAuthorityLegacyRead('redac_membership.status_view.line', {
      lineUserId,
      requestId
    });
  }

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
        redacMembershipIdLast4: derived.last4,
        authoritySource: derived.authoritySource,
        legacyReadUsed: derived.legacyReadUsed
      }
    });
  } catch (_err) {
    // best-effort only
  }

  return {
    ok: true,
    status: derived.status,
    last4: derived.last4,
    authoritySource: derived.authoritySource,
    legacyReadUsed: derived.legacyReadUsed
  };
}

module.exports = {
  getRedacMembershipStatusForLine
};
