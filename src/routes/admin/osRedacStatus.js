'use strict';

const { getDb } = require('../../infra/firestore');
const usersRepo = require('../../repos/firestore/usersRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId } = require('./osContext');
const {
  REDAC_CANONICAL_LINK_COLLECTION,
  REDAC_LEGACY_LINK_COLLECTION,
  resolveRedacMembershipFromRecord,
  resolveRedacLinkRecord,
  logCanonicalAuthorityLegacyRead
} = require('../../domain/canonicalAuthority');

function parseLimit(req) {
  const rawUrl = req && req.url ? String(req.url) : '/';
  const url = new URL(rawUrl, 'http://127.0.0.1');
  const raw = url.searchParams.get('limit');
  if (raw === null || raw === '') return 500;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return 500;
  return Math.max(1, Math.min(n, 2000));
}

function normalizeHash(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function summarize(users, links, secretConfigured) {
  const userHashSet = new Set();
  let usersLegacyReadSampled = 0;
  for (const user of users || []) {
    const resolved = resolveRedacMembershipFromRecord(user);
    const hash = normalizeHash(resolved.hash);
    if (resolved.legacyReadUsed) usersLegacyReadSampled += 1;
    if (hash) userHashSet.add(hash);
  }

  const linkHashSet = new Set();
  let linksLegacyReadSampled = 0;
  for (const link of links || []) {
    const resolved = resolveRedacLinkRecord(link, link && link.id);
    const hash = normalizeHash(resolved.hash);
    if (resolved.legacyReadUsed || String(link && link.collection || '') === REDAC_LEGACY_LINK_COLLECTION) {
      linksLegacyReadSampled += 1;
    }
    if (hash) linkHashSet.add(hash);
  }

  let orphanLinksSampled = 0;
  for (const hash of linkHashSet) {
    if (!userHashSet.has(hash)) orphanLinksSampled += 1;
  }

  let missingLinksSampled = 0;
  for (const hash of userHashSet) {
    if (!linkHashSet.has(hash)) missingLinksSampled += 1;
  }

  const usersSampled = Array.isArray(users) ? users.length : 0;
  const linksSampled = Array.isArray(links) ? links.length : 0;
  const usersWithHash = userHashSet.size;
  const usersWithLast4Only = (users || []).filter((u) => {
    const resolved = resolveRedacMembershipFromRecord(u);
    return !normalizeHash(resolved.hash) && normalizeHash(resolved.last4);
  }).length;
  const linksWithoutLineUserId = (links || []).filter((l) => !normalizeHash(l && l.lineUserId)).length;

  const issues = [];
  if (!secretConfigured) issues.push('secret_not_configured');
  if (orphanLinksSampled > 0) issues.push('orphan_links_detected');
  if (missingLinksSampled > 0) issues.push('missing_links_detected');
  if (usersWithLast4Only > 0) issues.push('users_with_last4_only');
  if (linksWithoutLineUserId > 0) issues.push('links_without_line_user_id');
  if (usersLegacyReadSampled > 0 || linksLegacyReadSampled > 0) issues.push('legacy_authority_read_detected');

  return {
    status: issues.length === 0 ? 'OK' : 'WARN',
    issues,
    usersSampled,
    linksSampled,
    usersWithHash,
    usersWithLast4Only,
    orphanLinksSampled,
    missingLinksSampled,
    linksWithoutLineUserId,
    usersLegacyReadSampled,
    linksLegacyReadSampled
  };
}

async function listLinksSample(limit) {
  const db = getDb();
  const [canonicalSnap, legacySnap] = await Promise.all([
    db.collection(REDAC_CANONICAL_LINK_COLLECTION).limit(limit).get(),
    db.collection(REDAC_LEGACY_LINK_COLLECTION).limit(limit).get()
  ]);

  const items = [];
  const seen = new Set();
  for (const doc of canonicalSnap.docs) {
    const id = String(doc.id || '');
    seen.add(id);
    items.push(Object.assign({ id, collection: REDAC_CANONICAL_LINK_COLLECTION }, doc.data()));
  }
  for (const doc of legacySnap.docs) {
    const id = String(doc.id || '');
    if (seen.has(id)) continue;
    items.push(Object.assign({ id, collection: REDAC_LEGACY_LINK_COLLECTION }, doc.data()));
  }
  return {
    items,
    authority: {
      canonicalCollection: REDAC_CANONICAL_LINK_COLLECTION,
      legacyCollection: REDAC_LEGACY_LINK_COLLECTION,
      canonicalSampleCount: canonicalSnap.docs.length,
      legacySampleCount: legacySnap.docs.length,
      legacyReadUsed: legacySnap.docs.length > 0
    }
  };
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const serverTime = new Date().toISOString();
  const sampleLimit = parseLimit(req);
  const secretConfigured = Boolean(normalizeHash(process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET));

  const [users, linksResult] = await Promise.all([
    usersRepo.listUsers({ limit: sampleLimit }),
    listLinksSample(sampleLimit)
  ]);

  const links = linksResult && Array.isArray(linksResult.items) ? linksResult.items : [];
  const authority = linksResult && linksResult.authority ? linksResult.authority : {
    canonicalCollection: REDAC_CANONICAL_LINK_COLLECTION,
    legacyCollection: REDAC_LEGACY_LINK_COLLECTION,
    canonicalSampleCount: 0,
    legacySampleCount: 0,
    legacyReadUsed: false
  };
  if (authority.legacyReadUsed) {
    logCanonicalAuthorityLegacyRead('redac_membership.status_view', {
      requestId,
      legacyCollection: authority.legacyCollection,
      legacySampleCount: authority.legacySampleCount
    });
  }
  const summary = summarize(users, links, secretConfigured);

  await appendAuditLog({
    actor,
    action: 'redac_membership.status.view',
    entityType: 'admin_os',
    entityId: 'redac_status',
    traceId,
    requestId,
    payloadSummary: Object.assign({ secretConfigured, sampleLimit, authority }, summary)
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime,
    traceId,
    requestId,
    sampleLimit,
    secretConfigured,
    authority,
    summary
  }));
}

module.exports = {
  handleStatus,
  summarize
};
