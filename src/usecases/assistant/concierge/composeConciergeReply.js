'use strict';

const { resolvePolicyForRequest, shouldAttachUrls } = require('../../../domain/llm/conciergePolicy');
const { selectUrls } = require('../../../domain/llm/urlRanker');
const { sanitizeCandidates } = require('../../../domain/llm/injectionGuard');
const { searchWebCandidates } = require('../../../infra/webSearch/provider');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function trimForLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 4500 ? `${text.slice(0, 4500)}...` : text;
}

function formatSourceFooters(selectedUrls) {
  const rows = Array.isArray(selectedUrls) ? selectedUrls : [];
  if (!rows.length) return '';
  return rows.map((row) => {
    const domain = normalizeText(row.domain);
    const path = normalizeText(row.path || '/');
    return `(source: ${domain}${path})`;
  }).join('\n');
}

function buildGuardDecisions(decisions) {
  return (Array.isArray(decisions) ? decisions : []).map((row) => ({
    rank: row.rank,
    domain: row.domain,
    path: row.path,
    allowed: row.allowed === true,
    reason: row.reason,
    source: row.source
  }));
}

function buildAuditMeta(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const selected = Array.isArray(payload.selected) ? payload.selected : [];
  const decisions = Array.isArray(payload.decisions) ? payload.decisions : [];
  const blockedReasons = Array.from(new Set((Array.isArray(payload.blockedReasons) ? payload.blockedReasons : []).filter(Boolean)));
  const citationRanks = Array.from(new Set(selected.map((row) => row.rank).filter(Boolean)));
  return {
    topic: payload.topic || 'general',
    mode: payload.mode || 'A',
    userTier: payload.userTier || 'free',
    citationRanks,
    urlCount: selected.length,
    urls: selected.map((row) => ({
      rank: row.rank,
      domain: row.domain,
      path: row.path,
      allowed: true,
      reason: row.reason,
      source: row.source
    })),
    guardDecisions: buildGuardDecisions(decisions),
    blockedReasons,
    injectionFindings: payload.injectionFindings === true
  };
}

async function composeConciergeReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const policy = resolvePolicyForRequest({
    question: payload.question,
    userTier: payload.userTier,
    plan: payload.plan,
    policy: payload.policy
  });

  const storedCandidates = Array.isArray(payload.storedCandidates) ? payload.storedCandidates : [];
  let webCandidates = [];
  const blockedReasons = [];

  if (policy.allowExternalSearch && policy.storedOnly !== true && policy.mode !== 'A') {
    const webResult = await searchWebCandidates({
      query: payload.question,
      locale: payload.locale || 'ja',
      limit: 5,
      env: payload.env
    });
    if (webResult.ok) {
      webCandidates = webResult.candidates;
    } else if (webResult.reason) {
      blockedReasons.push(webResult.reason);
    }
  }

  const sanitized = sanitizeCandidates([].concat(storedCandidates, webCandidates));
  if (sanitized.blockedReasons.length) blockedReasons.push(...sanitized.blockedReasons);
  const ranked = selectUrls(sanitized.candidates, {
    maxUrls: policy.maxUrls,
    allowedRanks: policy.allowedRanks
  }, {
    denylist: payload.denylist
  });

  const sourceSection = shouldAttachUrls(policy.mode, ranked.selected.length)
    ? formatSourceFooters(ranked.selected)
    : '';
  const baseReplyText = normalizeText(payload.baseReplyText);
  const replyText = sourceSection
    ? trimForLineMessage(`${baseReplyText}\n\n${sourceSection}`)
    : trimForLineMessage(baseReplyText);

  return {
    ok: true,
    replyText,
    mode: policy.mode,
    topic: policy.topic,
    userTier: policy.userTier,
    selectedUrls: ranked.selected,
    decisions: ranked.decisions,
    blockedReasons: Array.from(new Set(blockedReasons)),
    injectionFindings: sanitized.injectionFindings,
    auditMeta: buildAuditMeta({
      topic: policy.topic,
      mode: policy.mode,
      userTier: policy.userTier,
      selected: ranked.selected,
      decisions: ranked.decisions,
      blockedReasons,
      injectionFindings: sanitized.injectionFindings
    })
  };
}

module.exports = {
  composeConciergeReply
};
