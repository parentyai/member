'use strict';

const { detectIntent } = require('../router/detectIntent');
const { normalizeConversationIntent } = require('../router/normalizeConversationIntent');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
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
  const assistantCommitments = [];
  const recentUserGoals = [];
  const recentDomains = [];

  list.forEach((row) => {
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
  });

  return {
    assistantCommitments: assistantCommitments.slice(0, 6),
    recentUserGoals: recentUserGoals.slice(0, 6),
    recentDomains: recentDomains.slice(0, 4)
  };
}

function buildConversationPacket(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const intentDecision = detectIntent({ messageText });
  const normalizedConversationIntent = normalizeConversationIntent(messageText);
  const recentHistory = summarizeRecentActionRows(payload.recentActionRows);
  const llmFlags = payload.llmFlags && typeof payload.llmFlags === 'object' ? payload.llmFlags : {};

  return {
    lineUserId: normalizeText(payload.lineUserId),
    traceId: normalizeText(payload.traceId) || null,
    requestId: normalizeText(payload.requestId) || null,
    messageText,
    planInfo: payload.planInfo && typeof payload.planInfo === 'object' ? payload.planInfo : { plan: 'free', status: 'unknown' },
    explicitPaidIntent: normalizeText(payload.explicitPaidIntent) || null,
    paidIntent: normalizeText(payload.paidIntent) || 'faq_search',
    normalizedConversationIntent,
    intentDecision,
    routerMode: normalizeText(payload.routerMode || intentDecision.mode) || 'casual',
    routerReason: normalizeText(payload.routerReason || intentDecision.reason) || 'default_casual',
    contextSnapshot: payload.contextSnapshot && typeof payload.contextSnapshot === 'object' ? payload.contextSnapshot : null,
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
    opportunityDecision: payload.opportunityDecision && typeof payload.opportunityDecision === 'object'
      ? payload.opportunityDecision
      : null
  };
}

module.exports = {
  buildConversationPacket,
  summarizeRecentActionRows
};
