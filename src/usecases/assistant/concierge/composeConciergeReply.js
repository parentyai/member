'use strict';

const { resolvePolicyForRequest, shouldAttachUrls } = require('../../../domain/llm/conciergePolicy');
const { selectUrls } = require('../../../domain/llm/urlRanker');
const { sanitizeCandidates } = require('../../../domain/llm/injectionGuard');
const { selectConversationStyle } = require('../../../domain/llm/conversation/styleRouter');
const { resolveConversationState } = require('../../../domain/llm/conversation/conversationState');
const { resolveConversationMove } = require('../../../domain/llm/conversation/conversationMoves');
const {
  extractAnalysisFromBaseReply,
  composeConversationDraft
} = require('../../../domain/llm/conversation/conversationComposer');
const { humanizeConversationDraft } = require('../../../domain/llm/conversation/styleHumanizer');
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

function resolveFlagEnabled(name, fallback) {
  const raw = normalizeText(process.env[name]);
  if (!raw) return fallback;
  if (/^(0|false|off|no)$/i.test(raw)) return false;
  if (/^(1|true|on|yes)$/i.test(raw)) return true;
  return fallback;
}

function resolveTimeOfDay(input) {
  const value = Number(input);
  if (Number.isFinite(value) && value >= 0 && value <= 23) return Math.floor(value);
  return new Date().getHours();
}

function formatSourceFooters(selectedUrls, maxUrls) {
  const rows = Array.isArray(selectedUrls) ? selectedUrls : [];
  const cap = Number.isFinite(Number(maxUrls)) ? Math.max(0, Math.floor(Number(maxUrls))) : 0;
  if (!rows.length || cap <= 0) return '';
  const sources = rows
    .slice(0, cap)
    .map((row) => {
      const domain = normalizeText(row && row.domain);
      const path = normalizeText(row && row.path) || '/';
      if (!domain) return '';
      return `(source: ${domain}${path})`;
    })
    .filter(Boolean);
  if (!sources.length) return '';
  return `根拠: ${sources.join(', ')}`;
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
    injectionFindings: payload.injectionFindings === true,
    conversationState: payload.conversationState || null,
    conversationMove: payload.conversationMove || null,
    styleId: payload.styleId || null,
    conversationPattern: payload.conversationPattern || null,
    responseLength: Number.isFinite(Number(payload.responseLength)) ? Number(payload.responseLength) : 0
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

  const baseReplyText = normalizeText(payload.baseReplyText);
  const analysis = extractAnalysisFromBaseReply({ baseReplyText });
  const state = resolveConversationState({
    analysis,
    blockedReasons,
    question: payload.question
  });
  const move = resolveConversationMove({
    state: state.to,
    analysis,
    question: payload.question
  });
  const draftPacket = composeConversationDraft({
    analysis,
    state: state.to,
    move,
    baseReplyText
  });
  const styleEngineEnabled = resolveFlagEnabled('STYLE_ENGINE_ENABLED', true);
  const styleDecision = selectConversationStyle({
    topic: policy.topic,
    userTier: policy.userTier,
    question: payload.question,
    journeyPhase: payload.journeyPhase || '',
    messageLength: normalizeText(payload.question).length,
    timeOfDay: resolveTimeOfDay(payload.timeOfDay),
    urgency: payload.urgency || ''
  });
  const humanized = styleEngineEnabled
    ? humanizeConversationDraft({
      draftPacket,
      styleDecision,
      state: state.to,
      move
    })
    : {
      text: draftPacket.draft || baseReplyText,
      styleId: null,
      conversationPattern: null,
      responseLength: normalizeText(draftPacket.draft || baseReplyText).length
    };
  const sourceSection = shouldAttachUrls(policy.mode, ranked.selected.length)
    ? formatSourceFooters(ranked.selected, policy.maxUrls)
    : '';
  const mergedReply = sourceSection
    ? `${normalizeText(humanized.text || draftPacket.draft || baseReplyText)}\n\n${sourceSection}`
    : normalizeText(humanized.text || draftPacket.draft || baseReplyText);
  const replyText = trimForLineMessage(mergedReply);

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
      injectionFindings: sanitized.injectionFindings,
      conversationState: state.to,
      conversationMove: move,
      styleId: humanized.styleId,
      conversationPattern: humanized.conversationPattern,
      responseLength: normalizeText(mergedReply).length
    })
  };
}

module.exports = {
  composeConciergeReply
};
