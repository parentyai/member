'use strict';

const { resolveFollowupIntent } = require('../orchestrator/followupIntentResolver');
const {
  resolveProcedureReplyPacket,
  renderProcedureReplyPacket,
  buildProcedureSemanticFields
} = require('../procedureKnowledge/resolveProcedureReplyPacket');

const CONTEXTUAL_DOMAINS = new Set(['housing', 'school', 'ssn', 'banking']);

const FORBIDDEN_REPLY_PATTERN = /(FAQ候補|CityPack候補|根拠キー|score=|-\s*\[\]|関連情報です)/g;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDomainIntent(value) {
  const normalized = normalizeText(value).toLowerCase();
  return CONTEXTUAL_DOMAINS.has(normalized) ? normalized : 'general';
}

function sanitizeLine(value) {
  const text = normalizeText(value).replace(FORBIDDEN_REPLY_PATTERN, '').trim();
  if (!text) return '';
  return /[。!?？]$/.test(text) ? text : `${text}。`;
}

function trimForLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}

function resolveRecentContextDomain(recentActionRows) {
  const rows = Array.isArray(recentActionRows) ? recentActionRows : [];
  for (const row of rows) {
    const domain = normalizeDomainIntent(row && row.domainIntent);
    if (domain !== 'general') return domain;
  }
  return 'general';
}

function resolveFreeContextualFollowup(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const recentContextDomain = resolveRecentContextDomain(payload.recentActionRows);
  if (!messageText || recentContextDomain === 'general') return null;
  const messageDomainIntent = normalizeDomainIntent(payload.messageDomainIntent);
  const contextResumeDomain = messageDomainIntent !== 'general' ? messageDomainIntent : recentContextDomain;
  if (messageText.length > 16) return null;

  const followupDecision = resolveFollowupIntent({
    messageText,
    domainIntent: contextResumeDomain
  });
  const followupIntent = followupDecision && typeof followupDecision.followupIntent === 'string'
    ? followupDecision.followupIntent
    : null;
  const followupReason = followupDecision && typeof followupDecision.reason === 'string'
    ? followupDecision.reason
    : 'none';
  if (!followupIntent) return null;
  if (followupReason === 'domain_anchored_short_followup') return null;

  const procedurePacket = resolveProcedureReplyPacket({
    messageText,
    domainIntent: contextResumeDomain,
    followupIntent
  });
  const semanticFields = buildProcedureSemanticFields(procedurePacket, { maxQuickReplies: 3 });
  const replyText = trimForLineMessage(renderProcedureReplyPacket(procedurePacket, {
    mode: 'followup'
  }));

  const baseCarry = messageDomainIntent !== 'general' ? 0.88 : 0.84;
  const contextCarryScore = Math.max(0, Math.min(1, baseCarry + 0.08));

  return {
    replyText,
    contextResumeDomain,
    followupIntent,
    reason: 'contextual_free_followup',
    qualityMeta: {
      conciseModeApplied: true,
      directAnswerApplied: true,
      clarifySuppressed: true,
      repetitionPrevented: false,
      contextCarryScore,
      repeatRiskScore: 0.12
    },
    procedurePacket,
    semanticFields,
    nextSteps: semanticFields.nextSteps,
    warnings: semanticFields.warnings,
    quickReplies: semanticFields.quickReplies,
    evidenceRefs: semanticFields.evidenceRefs
  };
}

module.exports = {
  resolveFreeContextualFollowup
};
