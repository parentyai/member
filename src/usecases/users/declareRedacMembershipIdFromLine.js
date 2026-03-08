'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { appendAuditLog } = require('../audit/appendAuditLog');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const { SCENARIO_KEYS, STEP_KEYS, USER_SCENARIO_FIELD } = require('../../domain/constants');
const {
  normalizeRedacMembershipId,
  extractLast4,
  computeRedacMembershipIdHash
} = require('../../domain/redacMembershipId');
const {
  REDAC_CANONICAL_LINK_COLLECTION,
  REDAC_LEGACY_LINK_COLLECTION,
  REDAC_HASH_FIELD,
  REDAC_LAST4_FIELD,
  logCanonicalAuthorityLegacyRead
} = require('../../domain/canonicalAuthority');

const LINKS_COLLECTION = REDAC_CANONICAL_LINK_COLLECTION;

async function readLinkByHashInTx(db, tx, hash) {
  const canonicalRef = db.collection(REDAC_CANONICAL_LINK_COLLECTION).doc(hash);
  const canonicalSnap = await tx.get(canonicalRef);
  if (canonicalSnap.exists) {
    return {
      ref: canonicalRef,
      collection: REDAC_CANONICAL_LINK_COLLECTION,
      data: canonicalSnap.data() || {},
      legacyReadUsed: false
    };
  }
  const legacyRef = db.collection(REDAC_LEGACY_LINK_COLLECTION).doc(hash);
  const legacySnap = await tx.get(legacyRef);
  if (legacySnap.exists) {
    return {
      ref: legacyRef,
      collection: REDAC_LEGACY_LINK_COLLECTION,
      data: legacySnap.data() || {},
      legacyReadUsed: true
    };
  }
  return null;
}

function resolveHmacSecret() {
  const v = process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  const envName = process.env.ENV_NAME || 'local';
  if (envName === 'local' || process.env.NODE_ENV === 'test') return 'local-redac-membership-hmac-secret';
  return null;
}

function parseCommand(text) {
  const raw = typeof text === 'string' ? text : '';
  if (!raw) return { kind: 'noop' };
  // Accept: "会員ID 00-0000" (spaces allowed).
  // Return usage guidance when user typed only the membership prefix.
  const m = raw.match(/^\s*会員\s*[IiＩｉ][DdＤｄ](?:\s+(.+?))?\s*$/);
  if (!m) return { kind: 'noop' };
  const value = typeof m[1] === 'string' ? m[1].trim() : '';
  if (!value) return { kind: 'usage' };
  if (/^(help|ヘルプ)$/i.test(value)) return { kind: 'usage' };
  return { kind: 'cmd', value };
}

function logRedacBestEffortFailure(stage, requestId, lineUserId, err) {
  const message = err && err.message ? String(err.message) : 'error';
  console.warn(`[redac_membership] stage=${stage} requestId=${requestId || 'unknown'} lineUserId=${lineUserId || 'unknown'} message=${message}`);
}

async function ensureUserExistsInTx(tx, lineUserId) {
  const db = getDb();
  const userRef = db.collection('users').doc(lineUserId);
  const snap = await tx.get(userRef);
  if (snap.exists) return { userRef, user: Object.assign({ id: snap.id }, snap.data()) };

  // Create minimal defaults consistent with ensureUserFromWebhook().
  const data = {
    [USER_SCENARIO_FIELD]: SCENARIO_KEYS.A,
    stepKey: STEP_KEYS.THREE_MONTHS,
    memberNumber: null,
    memberCardAsset: null,
    createdAt: serverTimestamp()
  };
  tx.set(userRef, data, { merge: false });
  return { userRef, user: Object.assign({ id: lineUserId }, data) };
}

async function declareRedacMembershipIdFromLine(params) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  if (!lineUserId) throw new Error('lineUserId required');
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0
    ? payload.requestId.trim()
    : 'unknown';

  const parsed = parseCommand(payload.text);
  if (parsed.kind === 'noop') {
    return { ok: true, status: 'noop' };
  }
  if (parsed.kind === 'usage') {
    try {
      await appendAuditLog({
        actor: 'line',
        action: 'redac_membership.declare_usage',
        entityType: 'user',
        entityId: lineUserId,
        traceId: requestId,
        requestId,
        payloadSummary: { ok: false, reason: 'usage' }
      });
    } catch (err) {
      logRedacBestEffortFailure('declare_usage_audit', requestId, lineUserId, err);
    }
    return { ok: false, status: 'usage' };
  }

  const normalized = normalizeRedacMembershipId(parsed.value);
  if (!normalized) {
    try {
      await appendAuditLog({
        actor: 'line',
        action: 'redac_membership.declare_invalid',
        entityType: 'user',
        entityId: lineUserId,
        traceId: requestId,
        requestId,
        payloadSummary: { ok: false, reason: 'invalid_format' }
      });
    } catch (err) {
      logRedacBestEffortFailure('declare_invalid_audit', requestId, lineUserId, err);
    }
    return { ok: false, status: 'invalid_format' };
  }

  const last4 = extractLast4(normalized);
  const secret = resolveHmacSecret();
  if (!secret) {
    try {
      await appendAuditLog({
        actor: 'system',
        action: 'redac_membership.declare_invalid',
        entityType: 'user',
        entityId: lineUserId,
        traceId: requestId,
        requestId,
        payloadSummary: { ok: false, reason: 'server_misconfigured' }
      });
    } catch (err) {
      logRedacBestEffortFailure('declare_misconfigured_audit', requestId, lineUserId, err);
    }
    return { ok: false, status: 'server_misconfigured' };
  }

  const hash = computeRedacMembershipIdHash(normalized, secret);

  const db = getDb();
  const userRef = db.collection('users').doc(lineUserId);
  const txResult = await db.runTransaction(async (tx) => {
    const ensured = await ensureUserExistsInTx(tx, lineUserId);
    const user = ensured.user || {};
    const prevHash = typeof user.redacMembershipIdHash === 'string' ? user.redacMembershipIdHash : null;
    let legacyReadUsed = false;

    // If switching to a different membership id, release the previous link (only if it belongs to the same user).
    if (prevHash && prevHash !== hash) {
      const prevLink = await readLinkByHashInTx(db, tx, prevHash);
      if (prevLink) {
        if (prevLink.legacyReadUsed) legacyReadUsed = true;
        if (prevLink.data && prevLink.data.lineUserId === lineUserId) {
          tx.delete(prevLink.ref);
        }
      }
    }

    const existingLink = await readLinkByHashInTx(db, tx, hash);
    if (existingLink) {
      if (existingLink.legacyReadUsed) legacyReadUsed = true;
      const existing = existingLink.data || {};
      if (existing.lineUserId && existing.lineUserId !== lineUserId) {
        return {
          status: 'duplicate',
          legacyReadUsed,
          duplicateCollection: existingLink.collection
        };
      }
    }

    // Create/overwrite the link doc for this membership id.
    const linkRef = db.collection(REDAC_CANONICAL_LINK_COLLECTION).doc(hash);
    tx.set(linkRef, {
      [REDAC_HASH_FIELD]: hash,
      [REDAC_LAST4_FIELD]: last4,
      lineUserId,
      linkedAt: serverTimestamp(),
      linkedBy: 'user'
    }, { merge: false });

    tx.set(userRef, {
      redacMembershipIdHash: hash,
      redacMembershipIdLast4: last4,
      ridacMembershipIdHash: null,
      ridacMembershipIdLast4: null,
      redacMembershipDeclaredAt: serverTimestamp(),
      redacMembershipDeclaredBy: 'user'
    }, { merge: true });

    return { status: 'linked', legacyReadUsed };
  });

  const ok = txResult && txResult.status === 'linked';
  const status = txResult && typeof txResult.status === 'string' ? txResult.status : 'error';
  const legacyReadUsed = Boolean(txResult && txResult.legacyReadUsed);
  const duplicateCollection = txResult && typeof txResult.duplicateCollection === 'string'
    ? txResult.duplicateCollection
    : null;

  if (legacyReadUsed) {
    logCanonicalAuthorityLegacyRead('redac_membership.declare', {
      lineUserId,
      requestId,
      legacyCollection: REDAC_LEGACY_LINK_COLLECTION
    });
  }

  try {
    await appendAuditLog({
      actor: 'line',
      action: ok ? 'redac_membership.declare_ok' : 'redac_membership.declare_duplicate',
      entityType: 'user',
      entityId: lineUserId,
      traceId: requestId,
      requestId,
      payloadSummary: {
        ok,
        status,
        redacMembershipIdLast4: last4,
        authority: {
          canonicalCollection: REDAC_CANONICAL_LINK_COLLECTION,
          legacyCollection: REDAC_LEGACY_LINK_COLLECTION,
          legacyReadUsed,
          duplicateCollection
        }
      }
    });
  } catch (_err) {
    logRedacBestEffortFailure('declare_result_audit', requestId, lineUserId, _err);
  }

  try {
    await eventsRepo.createEvent({
      lineUserId,
      type: ok ? 'redac_membership.declare_ok' : 'redac_membership.declare_duplicate',
      ref: { requestId, redacMembershipIdLast4: last4 }
    });
  } catch (_err) {
    logRedacBestEffortFailure('declare_event_append', requestId, lineUserId, _err);
  }

  if (!ok && status === 'duplicate') {
    // Ensure the user doc does not get a partial update.
    // (Nothing to do: transaction guarded it.)
    return { ok: false, status: 'duplicate', last4, legacyReadUsed, duplicateCollection };
  }

  if (!ok) {
    // Unexpected.
    return { ok: false, status: 'error', legacyReadUsed };
  }

  // Also update derived memberNumber semantics if needed (not here).
  return { ok: true, status: 'linked', last4, legacyReadUsed };
}

module.exports = {
  declareRedacMembershipIdFromLine,
  parseCommand,
  resolveHmacSecret,
  LINKS_COLLECTION
};
