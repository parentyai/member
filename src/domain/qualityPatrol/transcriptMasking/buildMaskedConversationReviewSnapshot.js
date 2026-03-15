'use strict';

const crypto = require('node:crypto');
const { maskConversationReviewText } = require('./maskConversationReviewText');
const { regionPrompt, regionInvalid } = require('../../regionLineMessages');

const SNAPSHOT_VERSION = 'quality_patrol_review_snapshot_v1';

const TEXT_LENGTH_CAPS = Object.freeze({
  userMessage: 240,
  assistantReply: 420,
  priorContextSummary: 240
});

const SNAPSHOT_BUILD_SKIPPED_REASON = Object.freeze({
  assistantReplyMissing: 'assistant_reply_missing',
  sanitizedReplyEmpty: 'sanitized_reply_empty',
  maskingRemovedText: 'masking_removed_text',
  regionPromptFallback: 'region_prompt_fallback'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeToken(value) {
  return normalizeText(value).toLowerCase() || null;
}

function buildLineUserKey(lineUserId) {
  const source = normalizeText(lineUserId);
  if (!source) return null;
  return crypto.createHash('sha256').update(source, 'utf8').digest('hex').slice(0, 24);
}

function toBoolean(value) {
  return value === true;
}

function countReplacements(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, item) => {
    const count = Number(item && item.count);
    return Number.isFinite(count) ? sum + Math.max(0, Math.floor(count)) : sum;
  }, 0);
}

function createEmptySnapshotInputDiagnostics() {
  return {
    assistantReplyPresent: null,
    assistantReplyLength: null,
    sanitizedReplyLength: null,
    snapshotBuildAttempted: false,
    snapshotBuildSkippedReason: null
  };
}

function resolveSnapshotBuildSkippedReason(assistantReply, assistantReplySourceText) {
  const rawAssistantReply = normalizeText(assistantReplySourceText);
  const assistantReplyPresent = Boolean(rawAssistantReply);
  const sanitizedReplyLength = Number(assistantReply && assistantReply.storedLength) || 0;
  if (!assistantReplyPresent) return SNAPSHOT_BUILD_SKIPPED_REASON.assistantReplyMissing;
  if ([regionPrompt(), regionInvalid()].map(normalizeText).includes(rawAssistantReply)) {
    return SNAPSHOT_BUILD_SKIPPED_REASON.regionPromptFallback;
  }
  if (sanitizedReplyLength > 0) return null;
  if (countReplacements(assistantReply && assistantReply.replacements) > 0) {
    return SNAPSHOT_BUILD_SKIPPED_REASON.maskingRemovedText;
  }
  return SNAPSHOT_BUILD_SKIPPED_REASON.sanitizedReplyEmpty;
}

function buildSnapshotInputDiagnostics(assistantReply, assistantReplySourceText) {
  const rawAssistantReply = normalizeText(assistantReplySourceText);
  return {
    assistantReplyPresent: Boolean(rawAssistantReply),
    assistantReplyLength: rawAssistantReply.length,
    sanitizedReplyLength: Number(assistantReply && assistantReply.storedLength) || 0,
    snapshotBuildAttempted: true,
    snapshotBuildSkippedReason: resolveSnapshotBuildSkippedReason(assistantReply, assistantReplySourceText)
  };
}

function extractTaskLines(contextSnapshot) {
  const snapshot = contextSnapshot && typeof contextSnapshot === 'object' ? contextSnapshot : null;
  if (!snapshot) return [];
  const rows = Array.isArray(snapshot.topTasks)
    ? snapshot.topTasks
    : (Array.isArray(snapshot.topOpenTasks)
      ? snapshot.topOpenTasks
      : (Array.isArray(snapshot.openTasksTop5) ? snapshot.openTasksTop5 : []));
  return rows
    .map((item) => {
      const source = item && typeof item === 'object' ? item : {};
      const title = normalizeText(source.title || source.label || source.todoKey || source.taskKey || source.stepKey || '');
      const status = normalizeText(source.status || source.graphStatus || '');
      if (!title && !status) return '';
      return status ? `${title || 'task'}(${status})` : title;
    })
    .filter(Boolean)
    .slice(0, 2);
}

function buildPriorContextSummaryText(payload) {
  const lines = [];
  const phaseSource = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? normalizeText(payload.contextSnapshot.phase || payload.contextSnapshot.journeyPhase || '')
    : '';
  const resumeDomain = normalizeToken(payload.contextResumeDomain);
  const followupIntent = normalizeToken(payload.followupIntent);
  const recentUserGoal = normalizeText(payload.recentUserGoal);

  if (resumeDomain) lines.push(`resume_domain:${resumeDomain}`);
  if (phaseSource) lines.push(`journey_phase:${phaseSource.toLowerCase()}`);
  if (followupIntent) lines.push(`followup_intent:${followupIntent}`);
  if (recentUserGoal) lines.push(`recent_goal:${recentUserGoal}`);

  const tasks = extractTaskLines(payload.contextSnapshot);
  if (tasks.length) lines.push(`open_tasks:${tasks.join(' / ')}`);

  return lines.join('\n');
}

function buildMaskedConversationReviewSnapshot(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const userMessage = maskConversationReviewText({
    text: payload.userMessageText || '',
    maxLength: TEXT_LENGTH_CAPS.userMessage
  });
  const assistantReply = maskConversationReviewText({
    text: payload.assistantReplyText || '',
    maxLength: TEXT_LENGTH_CAPS.assistantReply
  });
  const priorContextSummarySource = normalizeText(payload.priorContextSummaryText)
    || buildPriorContextSummaryText(payload);
  const priorContextSummary = maskConversationReviewText({
    text: priorContextSummarySource,
    maxLength: TEXT_LENGTH_CAPS.priorContextSummary
  });
  const snapshotInputDiagnostics = buildSnapshotInputDiagnostics(
    assistantReply,
    payload.assistantReplyText || ''
  );

  return {
    snapshotVersion: SNAPSHOT_VERSION,
    lineUserKey: buildLineUserKey(payload.lineUserId),
    traceId: normalizeText(payload.traceId) || null,
    requestId: normalizeText(payload.requestId) || null,
    routeKind: normalizeToken(payload.routeKind),
    domainIntent: normalizeToken(payload.domainIntent),
    strategy: normalizeToken(payload.strategy),
    selectedCandidateKind: normalizeToken(payload.selectedCandidateKind),
    fallbackTemplateKind: normalizeToken(payload.fallbackTemplateKind),
    replyTemplateFingerprint: normalizeText(payload.replyTemplateFingerprint) || null,
    priorContextUsed: toBoolean(payload.priorContextUsed),
    followupResolvedFromHistory: toBoolean(payload.followupResolvedFromHistory),
    knowledgeCandidateUsed: toBoolean(payload.knowledgeCandidateUsed),
    readinessDecision: normalizeToken(payload.readinessDecision),
    genericFallbackSlice: normalizeToken(payload.genericFallbackSlice),
    userMessageMasked: userMessage.text,
    assistantReplyMasked: assistantReply.text,
    priorContextSummaryMasked: priorContextSummary.text,
    userMessageAvailable: userMessage.available,
    assistantReplyAvailable: assistantReply.available,
    priorContextSummaryAvailable: priorContextSummary.available,
    textPolicy: {
      userMessage: {
        originalLength: userMessage.originalLength,
        storedLength: userMessage.storedLength,
        truncated: userMessage.truncated,
        replacements: userMessage.replacements
      },
      assistantReply: {
        originalLength: assistantReply.originalLength,
        storedLength: assistantReply.storedLength,
        truncated: assistantReply.truncated,
        replacements: assistantReply.replacements
      },
      priorContextSummary: {
        originalLength: priorContextSummary.originalLength,
        storedLength: priorContextSummary.storedLength,
        truncated: priorContextSummary.truncated,
        replacements: priorContextSummary.replacements
      }
    },
    snapshotInputDiagnostics,
    createdAt: normalizeText(payload.createdAt) || null
  };
}

module.exports = {
  SNAPSHOT_VERSION,
  SNAPSHOT_BUILD_SKIPPED_REASON,
  TEXT_LENGTH_CAPS,
  createEmptySnapshotInputDiagnostics,
  buildMaskedConversationReviewSnapshot,
  buildLineUserKey
};
