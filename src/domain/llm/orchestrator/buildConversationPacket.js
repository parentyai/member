'use strict';

const { detectIntent } = require('../router/detectIntent');
const { normalizeConversationIntent } = require('../router/normalizeConversationIntent');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toTimestamp(value) {
  if (!value) return 0;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1000000000000 ? value : value * 1000;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return 0;
}

function normalizeStringList(value, limit) {
  const rows = Array.isArray(value) ? value : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 8;
  const out = [];
  rows.forEach((item) => {
    if (out.length >= max) return;
    const normalized = normalizeText(item);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function summarizeRecentActionRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const ordered = list
    .slice()
    .sort((left, right) => toTimestamp(right && right.createdAt) - toTimestamp(left && left.createdAt));
  const assistantCommitments = [];
  const recentUserGoals = [];
  const recentDomains = [];
  const recentResponseHints = [];

  ordered.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    normalizeStringList(row.committedNextActions, 3).forEach((item) => {
      if (!assistantCommitments.includes(item)) assistantCommitments.push(item);
    });
    const followupQuestion = normalizeText(row.committedFollowupQuestion);
    if (followupQuestion && !assistantCommitments.includes(followupQuestion)) {
      assistantCommitments.push(followupQuestion);
    }
    const recentGoal = normalizeText(row.recentUserGoal);
    if (recentGoal && !recentUserGoals.includes(recentGoal)) recentUserGoals.push(recentGoal);
    const domainIntent = normalizeText(row.domainIntent).toLowerCase();
    if (domainIntent && domainIntent !== 'general' && !recentDomains.includes(domainIntent)) {
      recentDomains.push(domainIntent);
    }
    const responseHint = normalizeText(row.replyText || row.committedFollowupQuestion || '');
    if (responseHint && !recentResponseHints.includes(responseHint)) {
      recentResponseHints.push(responseHint);
    }
  });

  return {
    assistantCommitments: assistantCommitments.slice(0, 6),
    recentUserGoals: recentUserGoals.slice(0, 6),
    recentDomains: recentDomains.slice(0, 4),
    recentResponseHints: recentResponseHints.slice(0, 6)
  };
}

function isLowInformationMessage(text) {
  const normalized = normalizeText(text);
  if (!normalized) return true;
  if (normalized.length <= 8) return true;
  if (/^(それで|それは|そうなんだ|なるほど|うん|はい|了解|後は何[?？]?|次は[?？]?|つぎは[?？]?)$/i.test(normalized)) return true;
  return false;
}

function buildConversationPacket(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const intentDecision = detectIntent({ messageText });
  const detectedConversationIntent = normalizeConversationIntent(messageText);
  const recentHistory = summarizeRecentActionRows(payload.recentActionRows);
  const lowInformationMessage = isLowInformationMessage(messageText);
  const recentDomain = recentHistory.recentDomains[0] || null;
  const contextResume = detectedConversationIntent === 'general'
    && lowInformationMessage
    && Boolean(recentDomain)
    && intentDecision.mode !== 'greeting'
    && intentDecision.reason !== 'smalltalk_detected';
  const normalizedConversationIntent = contextResume ? recentDomain : detectedConversationIntent;
  const providedRouterReason = normalizeText(payload.routerReason);
  const routerReason = contextResume
    ? 'contextual_domain_resume'
    : (providedRouterReason || normalizeText(intentDecision.reason) || 'default_casual');
  const llmFlags = payload.llmFlags && typeof payload.llmFlags === 'object' ? payload.llmFlags : {};

  return {
    lineUserId: normalizeText(payload.lineUserId),
    traceId: normalizeText(payload.traceId) || null,
    requestId: normalizeText(payload.requestId) || null,
    messageText,
    planInfo: payload.planInfo && typeof payload.planInfo === 'object' ? payload.planInfo : { plan: 'free', status: 'unknown' },
    explicitPaidIntent: normalizeText(payload.explicitPaidIntent) || null,
    paidIntent: normalizeText(payload.paidIntent) || 'faq_search',
    detectedConversationIntent,
    normalizedConversationIntent,
    intentDecision,
    routerMode: normalizeText(payload.routerMode || intentDecision.mode) || 'casual',
    routerReason,
    contextSnapshot: payload.contextSnapshot && typeof payload.contextSnapshot === 'object' ? payload.contextSnapshot : null,
    contextResume,
    contextResumeDomain: contextResume ? recentDomain : null,
    lowInformationMessage,
    llmFlags: {
      llmConciergeEnabled: llmFlags.llmConciergeEnabled === true,
      llmWebSearchEnabled: llmFlags.llmWebSearchEnabled !== false,
      llmStyleEngineEnabled: llmFlags.llmStyleEngineEnabled !== false,
      llmBanditEnabled: llmFlags.llmBanditEnabled === true,
      qualityEnabled: llmFlags.qualityEnabled !== false,
      snapshotStrictMode: llmFlags.snapshotStrictMode === true
    },
    maxNextActionsCap: Number.isFinite(Number(payload.maxNextActionsCap)) ? Number(payload.maxNextActionsCap) : null,
    recentEngagement: payload.recentEngagement && typeof payload.recentEngagement === 'object'
      ? payload.recentEngagement
      : { recentTurns: 0, recentInterventions: 0, recentClicks: false, recentTaskDone: false },
    recentAssistantCommitments: recentHistory.assistantCommitments,
    recentUserGoals: recentHistory.recentUserGoals,
    recentDomains: recentHistory.recentDomains,
    recentResponseHints: recentHistory.recentResponseHints,
    opportunityDecision: payload.opportunityDecision && typeof payload.opportunityDecision === 'object'
      ? payload.opportunityDecision
      : null
  };
}

module.exports = {
  buildConversationPacket,
  summarizeRecentActionRows
};
