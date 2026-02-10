'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const {
  normalizeRidacMembershipId,
  extractLast4,
  computeRidacMembershipIdHash
} = require('../../domain/ridacMembershipId');

const LINKS_COLLECTION = 'ridac_membership_links';

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

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (_err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function resolveHmacSecret() {
  const v = process.env.RIDAC_MEMBERSHIP_ID_HMAC_SECRET;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

async function handleRidacMembershipUnlink(req, res, body) {
  const actor = resolveActor(req);
  const requestId = resolveRequestId(req);

  const payload = parseJson(body, res);
  if (!payload) return;

  const rawId = typeof payload.ridacMembershipId === 'string' ? payload.ridacMembershipId : '';
  const normalized = normalizeRidacMembershipId(rawId);
  if (!normalized) {
    try {
      await appendAuditLog({
        actor,
        action: 'ridac_membership.unlink_invalid',
        entityType: 'ridac_membership',
        entityId: 'unknown',
        traceId: requestId,
        requestId,
        payloadSummary: { ok: false, reason: 'invalid_format' }
      });
    } catch (_err) {}
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid ridacMembershipId format' }));
    return;
  }

  const last4 = extractLast4(normalized);
  const secret = resolveHmacSecret();
  if (!secret) {
    try {
      await appendAuditLog({
        actor: 'system',
        action: 'ridac_membership.unlink_invalid',
        entityType: 'ridac_membership',
        entityId: 'unknown',
        traceId: requestId,
        requestId,
        payloadSummary: { ok: false, reason: 'server_misconfigured' }
      });
    } catch (_err) {}
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'server misconfigured' }));
    return;
  }

  let hash;
  try {
    hash = computeRidacMembershipIdHash(normalized, secret);
  } catch (err) {
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'server misconfigured' }));
    return;
  }

  const db = getDb();
  const linkRef = db.collection(LINKS_COLLECTION).doc(hash);

  const txResult = await db.runTransaction(async (tx) => {
    const snap = await tx.get(linkRef);
    if (!snap.exists) return { status: 'not_found' };
    const data = snap.data() || {};
    const lineUserId = typeof data.lineUserId === 'string' ? data.lineUserId : null;

    tx.delete(linkRef);

    if (lineUserId) {
      const userRef = db.collection('users').doc(lineUserId);
      tx.set(userRef, {
        ridacMembershipIdHash: null,
        ridacMembershipIdLast4: null,
        ridacMembershipUnlinkedAt: serverTimestamp(),
        ridacMembershipUnlinkedBy: 'ops'
      }, { merge: true });
    }

    return { status: 'ok', lineUserId };
  });

  if (!txResult || txResult.status === 'not_found') {
    try {
      await appendAuditLog({
        actor,
        action: 'ridac_membership.unlink_not_found',
        entityType: 'ridac_membership',
        entityId: hash,
        traceId: requestId,
        requestId,
        payloadSummary: { ok: false, status: 'not_found', ridacMembershipIdLast4: last4 }
      });
    } catch (_err) {}
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'not_found' }));
    return;
  }

  const lineUserId = txResult.lineUserId || null;

  try {
    await appendAuditLog({
      actor,
      action: 'ridac_membership.unlink_ok',
      entityType: 'ridac_membership',
      entityId: hash,
      traceId: requestId,
      requestId,
      payloadSummary: { ok: true, ridacMembershipIdLast4: last4, lineUserId }
    });
  } catch (_err) {}

  if (lineUserId) {
    try {
      await eventsRepo.createEvent({
        lineUserId,
        type: 'ridac_membership.unlink_ok',
        ref: { requestId, ridacMembershipIdLast4: last4 }
      });
    } catch (_err) {}
  }

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, lineUserId, ridacMembershipIdLast4: last4 }));
}

module.exports = {
  handleRidacMembershipUnlink
};

