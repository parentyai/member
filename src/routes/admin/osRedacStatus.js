'use strict';

const { getDb } = require('../../infra/firestore');
const usersRepo = require('../../repos/firestore/usersRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

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
  for (const user of users || []) {
    const hash = normalizeHash(user && user.redacMembershipIdHash);
    if (hash) userHashSet.add(hash);
  }

  const linkHashSet = new Set();
  for (const link of links || []) {
    const hash = normalizeHash((link && link.redacMembershipIdHash) || (link && link.id));
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
  const usersWithLast4Only = (users || []).filter((u) => !normalizeHash(u && u.redacMembershipIdHash) && normalizeHash(u && u.redacMembershipIdLast4)).length;
  const linksWithoutLineUserId = (links || []).filter((l) => !normalizeHash(l && l.lineUserId)).length;

  const issues = [];
  if (!secretConfigured) issues.push('secret_not_configured');
  if (orphanLinksSampled > 0) issues.push('orphan_links_detected');
  if (missingLinksSampled > 0) issues.push('missing_links_detected');
  if (usersWithLast4Only > 0) issues.push('users_with_last4_only');
  if (linksWithoutLineUserId > 0) issues.push('links_without_line_user_id');

  return {
    status: issues.length === 0 ? 'OK' : 'WARN',
    issues,
    usersSampled,
    linksSampled,
    usersWithHash,
    usersWithLast4Only,
    orphanLinksSampled,
    missingLinksSampled,
    linksWithoutLineUserId
  };
}

async function listLinksSample(limit) {
  const db = getDb();
  const snap = await db.collection('redac_membership_links').limit(limit).get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const serverTime = new Date().toISOString();
  const sampleLimit = parseLimit(req);
  const secretConfigured = Boolean(normalizeHash(process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET));

  const [users, links] = await Promise.all([
    usersRepo.listUsers({ limit: sampleLimit }),
    listLinksSample(sampleLimit)
  ]);

  const summary = summarize(users, links, secretConfigured);

  await appendAuditLog({
    actor,
    action: 'redac_membership.status.view',
    entityType: 'admin_os',
    entityId: 'redac_status',
    traceId,
    requestId,
    payloadSummary: Object.assign({ secretConfigured, sampleLimit }, summary)
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime,
    traceId,
    requestId,
    sampleLimit,
    secretConfigured,
    summary
  }));
}

module.exports = {
  handleStatus,
  summarize
};

