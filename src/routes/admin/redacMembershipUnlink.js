'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const {
  normalizeRedacMembershipId,
  extractLast4,
  computeRedacMembershipIdHash
} = require('../../domain/redacMembershipId');
const {
  REDAC_CANONICAL_LINK_COLLECTION,
  REDAC_LEGACY_LINK_COLLECTION,
  logCanonicalAuthorityLegacyRead
} = require('../../domain/canonicalAuthority');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.redac_membership_unlink';

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

function resolveActor(req) {
  const actor = req && req.headers && req.headers['x-actor'];
  if (typeof actor === 'string' && actor.trim().length > 0) return actor.trim();
  return 'unknown';
}

function resolveRequestId(req) {
  const headerId = req && req.headers && req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.length > 0) return headerId;
  const trace = req && req.headers && req.headers['x-cloud-trace-context'];
  if (typeof trace === 'string' && trace.length > 0) return trace.split('/')[0];
  return 'unknown';
}

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (_err) {
    writeJson(res, 400, { ok: false, error: 'invalid json' }, {
      state: 'error',
      reason: 'invalid_json'
    });
    return null;
  }
}

function resolveHmacSecret() {
  const v = process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function logRedacAdminBestEffortFailure(stage, requestId, err) {
  const message = err && err.message ? String(err.message) : 'error';
  console.warn(`[redac_membership_admin] stage=${stage} requestId=${requestId || 'unknown'} message=${message}`);
}

async function handleRedacMembershipUnlink(req, res, body) {
  const actor = resolveActor(req);
  const requestId = resolveRequestId(req);

  const payload = parseJson(body, res);
  if (!payload) return;

  const rawId = typeof payload.redacMembershipId === 'string' ? payload.redacMembershipId : '';
  const normalized = normalizeRedacMembershipId(rawId);
  if (!normalized) {
    try {
      await appendAuditLog({
        actor,
        action: 'redac_membership.unlink_invalid',
        entityType: 'redac_membership',
        entityId: 'unknown',
        traceId: requestId,
        requestId,
        payloadSummary: { ok: false, reason: 'invalid_format' }
      });
    } catch (err) {
      logRedacAdminBestEffortFailure('unlink_invalid_audit', requestId, err);
    }
    writeJson(res, 400, { ok: false, error: 'invalid redacMembershipId format' }, {
      state: 'error',
      reason: 'invalid_redac_membership_id_format'
    });
    return;
  }

  const last4 = extractLast4(normalized);
  const secret = resolveHmacSecret();
  if (!secret) {
    try {
      await appendAuditLog({
        actor: 'system',
        action: 'redac_membership.unlink_invalid',
        entityType: 'redac_membership',
        entityId: 'unknown',
        traceId: requestId,
        requestId,
        payloadSummary: { ok: false, reason: 'server_misconfigured' }
      });
    } catch (err) {
      logRedacAdminBestEffortFailure('unlink_misconfigured_audit', requestId, err);
    }
    writeJson(res, 503, { ok: false, error: 'server misconfigured' }, {
      state: 'error',
      reason: 'server_misconfigured'
    });
    return;
  }

  let hash;
  try {
    hash = computeRedacMembershipIdHash(normalized, secret);
  } catch (err) {
    writeJson(res, 503, { ok: false, error: 'server misconfigured' }, {
      state: 'error',
      reason: 'server_misconfigured'
    });
    return;
  }

  try {
    const db = getDb();
    const txResult = await db.runTransaction(async (tx) => {
      const link = await readLinkByHashInTx(db, tx, hash);
      if (!link) return { status: 'not_found', legacyReadUsed: false };
      const data = link.data || {};
      const lineUserId = typeof data.lineUserId === 'string' ? data.lineUserId : null;

      tx.delete(link.ref);

      if (lineUserId) {
        const userRef = db.collection('users').doc(lineUserId);
        tx.set(userRef, {
          redacMembershipIdHash: null,
          redacMembershipIdLast4: null,
          ridacMembershipIdHash: null,
          ridacMembershipIdLast4: null,
          redacMembershipUnlinkedAt: serverTimestamp(),
          redacMembershipUnlinkedBy: 'ops'
        }, { merge: true });
      }

      return {
        status: 'ok',
        lineUserId,
        legacyReadUsed: Boolean(link.legacyReadUsed),
        linkCollectionRead: link.collection
      };
    });

    if (!txResult || txResult.status === 'not_found') {
      try {
        await appendAuditLog({
          actor,
          action: 'redac_membership.unlink_not_found',
          entityType: 'redac_membership',
          entityId: hash,
          traceId: requestId,
          requestId,
          payloadSummary: { ok: false, status: 'not_found', redacMembershipIdLast4: last4 }
        });
      } catch (err) {
        logRedacAdminBestEffortFailure('unlink_not_found_audit', requestId, err);
      }
      writeJson(res, 404, { ok: false, error: 'not_found' }, {
        state: 'error',
        reason: 'redac_membership_not_found'
      });
      return;
    }

    const lineUserId = txResult.lineUserId || null;
    const legacyReadUsed = Boolean(txResult.legacyReadUsed);
    const linkCollectionRead = typeof txResult.linkCollectionRead === 'string'
      ? txResult.linkCollectionRead
      : REDAC_CANONICAL_LINK_COLLECTION;
    if (legacyReadUsed) {
      logCanonicalAuthorityLegacyRead('redac_membership.unlink', {
        requestId,
        legacyCollection: REDAC_LEGACY_LINK_COLLECTION
      });
    }

    try {
      await appendAuditLog({
        actor,
        action: 'redac_membership.unlink_ok',
        entityType: 'redac_membership',
        entityId: hash,
        traceId: requestId,
        requestId,
        payloadSummary: {
          ok: true,
          redacMembershipIdLast4: last4,
          lineUserId,
          authority: {
            canonicalCollection: REDAC_CANONICAL_LINK_COLLECTION,
            legacyCollection: REDAC_LEGACY_LINK_COLLECTION,
            legacyReadUsed,
            linkCollectionRead
          }
        }
      });
    } catch (err) {
      logRedacAdminBestEffortFailure('unlink_ok_audit', requestId, err);
    }

    if (lineUserId) {
      try {
        await eventsRepo.createEvent({
          lineUserId,
          type: 'redac_membership.unlink_ok',
          ref: { requestId, redacMembershipIdLast4: last4 }
        });
      } catch (err) {
        logRedacAdminBestEffortFailure('unlink_event_append', requestId, err);
      }
    }

    writeJson(res, 200, {
      ok: true,
      lineUserId,
      redacMembershipIdLast4: last4,
      legacyReadUsed,
      linkCollectionRead
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRedacAdminBestEffortFailure('unlink_route', requestId, err);
    writeJson(res, 500, { ok: false, error: 'error' }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleRedacMembershipUnlink
};
