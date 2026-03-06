'use strict';

const { buildConciergeContextSnapshot } = require('./concierge/composeConciergeReply');

const FORBIDDEN_REPLY_PATTERN = /(FAQ候補|CityPack候補|根拠キー|score=|-\s*\[\]|関連情報です)/g;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function sanitizeReplyLine(value) {
  return normalizeText(value).replace(FORBIDDEN_REPLY_PATTERN, '');
}

function trimForLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 420 ? `${text.slice(0, 420)}…` : text;
}

function normalizeActions(value) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = sanitizeReplyLine(item);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 3);
}

function normalizeReasonKeys(value) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  if (!out.includes('housing_intent')) out.push('housing_intent');
  return out.slice(0, 8);
}

function formatTaskLabel(task) {
  if (!task || typeof task !== 'object') return '';
  const key = normalizeText(task.key || task.title || task.id);
  if (!key) return '';
  return key.replace(/_/g, ' ');
}

function buildFallbackActions(context) {
  const nextActions = [];
  if (context && context.blockedTask) {
    const blockedLabel = formatTaskLabel(context.blockedTask);
    if (blockedLabel) nextActions.push(`${blockedLabel}の必要書類を先に揃える`);
  }
  if (context && context.dueSoonTask) {
    const dueSoonLabel = formatTaskLabel(context.dueSoonTask);
    if (dueSoonLabel) nextActions.push(`${dueSoonLabel}の期限と窓口を確認する`);
  }
  if (context && Array.isArray(context.topTasks)) {
    context.topTasks.forEach((task) => {
      const label = formatTaskLabel(task);
      if (!label) return;
      nextActions.push(`${label}の条件を整理する`);
    });
  }
  nextActions.push('希望条件を3つに絞る');
  nextActions.push('予算と入居時期を決める');
  nextActions.push('審査に必要な書類を確認する');
  return normalizeActions(nextActions);
}

function buildFallbackQuestion(context) {
  const phase = normalizeText(context && context.phase).toLowerCase();
  if (phase === 'return') return '帰任時期が分かれば、優先順位を具体化できます。';
  return '希望エリアや入居時期が分かれば、次の一手を具体化できます。';
}

function buildNaturalHousingReply(parts) {
  const payload = parts && typeof parts === 'object' ? parts : {};
  const lines = ['住まい探しの相談ですね。'];
  const actions = normalizeActions(payload.nextActions);
  if (actions.length) {
    lines.push('まずは次の一手から進めましょう。');
    actions.slice(0, 3).forEach((action) => {
      lines.push(`・${action}`);
    });
  }
  const pitfall = sanitizeReplyLine(payload.pitfall) || '詰まりやすいのは審査に必要な書類の不足です。';
  lines.push(`多くの人が詰まりやすいのは ${pitfall}`);
  const question = sanitizeReplyLine(payload.followupQuestion);
  if (question) lines.push(question);
  return trimForLineMessage(lines.filter(Boolean).join('\n'));
}

function buildHousingAuditMeta(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const blockedReason = normalizeText(payload.blockedReason);
  const blockedReasons = blockedReason ? [blockedReason] : [];
  return {
    topic: 'housing',
    mode: 'B',
    userTier: 'paid',
    citationRanks: [],
    urlCount: 0,
    urls: [],
    guardDecisions: [],
    blockedReasons,
    injectionFindings: false,
    evidenceNeed: 'none',
    evidenceOutcome: blockedReasons.length ? 'BLOCKED' : 'SUPPORTED',
    chosenAction: null,
    contextVersion: 'concierge_ctx_v1',
    featureHash: null,
    postRenderLint: { findings: [], modified: false },
    contextSignature: null,
    contextualBanditEnabled: false,
    contextualFeatures: null,
    counterfactualSelectedArmId: null,
    counterfactualSelectedRank: null,
    counterfactualTopArms: [],
    counterfactualEval: null
  };
}

function generatePaidHousingConciergeReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const contextSnapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : null;
  const conciergeContext = buildConciergeContextSnapshot(contextSnapshot);
  const decision = payload.opportunityDecision && typeof payload.opportunityDecision === 'object'
    ? payload.opportunityDecision
    : null;

  const reasonKeys = normalizeReasonKeys(decision && Array.isArray(decision.opportunityReasonKeys)
    ? decision.opportunityReasonKeys
    : []);
  const suggestedAtoms = decision && decision.suggestedAtoms && typeof decision.suggestedAtoms === 'object'
    ? decision.suggestedAtoms
    : {};
  const nextActions = normalizeActions(suggestedAtoms.nextActions);
  const fallbackActions = buildFallbackActions(conciergeContext);
  const question = sanitizeReplyLine(suggestedAtoms.question) || buildFallbackQuestion(conciergeContext);
  const replyText = buildNaturalHousingReply({
    nextActions: nextActions.length ? nextActions : fallbackActions,
    pitfall: suggestedAtoms.pitfall,
    followupQuestion: question
  });

  return {
    ok: true,
    conversationMode: 'concierge',
    opportunityType: decision && typeof decision.opportunityType === 'string' && decision.opportunityType.trim()
      ? decision.opportunityType
      : 'action',
    opportunityReasonKeys: reasonKeys,
    interventionBudget: 1,
    replyText: replyText || '住まい探しの相談ですね。まずは希望条件と必要書類から整理しましょう。',
    auditMeta: buildHousingAuditMeta(payload)
  };
}

module.exports = {
  generatePaidHousingConciergeReply
};
