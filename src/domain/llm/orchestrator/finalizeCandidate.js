'use strict';

const {
  sanitizePaidMainReply,
  containsLegacyTemplateTerms
} = require('../conversation/paidReplyGuard');
const {
  buildReplyTemplateFingerprint,
  classifyReplyTemplateKind
} = require('../conversation/replyTemplateTelemetry');
const { applyAnswerReadinessDecision } = require('../quality/applyAnswerReadinessDecision');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function trimForPaidLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 420 ? `${text.slice(0, 420)}…` : text;
}

function extractActionBullets(text) {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('・'))
    .map((line) => line.replace(/^・\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
}

function extractFollowupQuestion(text) {
  const lines = normalizeText(text).split('\n').map((line) => line.trim()).filter(Boolean);
  const questionLine = lines.find((line) => /[?？]$/.test(line) || line.includes('ですか'));
  return questionLine || null;
}

function finalizeCandidate(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const selected = payload.selected && typeof payload.selected === 'object' ? payload.selected : {};
  const verificationOutcome = normalizeText(payload.verificationOutcome) || 'passed';
  const readinessDecision = normalizeText(payload.readinessDecision) || 'allow';
  const readinessSafeResponseMode = normalizeText(payload.readinessSafeResponseMode) || 'answer';
  const contradictionFlags = Array.isArray(payload.contradictionFlags) ? payload.contradictionFlags : [];
  const fallbackText = normalizeText(payload.fallbackText)
    || '状況を整理しながら進めます。優先手続きを1つ決めて進めましょう。';
  const readinessClarifyText = normalizeText(payload.readinessClarifyText);
  const atoms = selected.atoms && typeof selected.atoms === 'object' ? selected.atoms : {};
  const preserveReplyText = selected.preserveReplyText === true;

  const guardResult = preserveReplyText
    ? null
    : sanitizePaidMainReply(selected.replyText, {
      fallbackText,
      situationLine: atoms.situationLine || '',
      nextActions: Array.isArray(atoms.nextActions) ? atoms.nextActions : [],
      pitfall: atoms.pitfall || '',
      followupQuestion: atoms.followupQuestion || '',
      defaultQuestion: verificationOutcome === 'clarify'
        ? 'まず対象手続きと期限を1つずつ教えてください。'
        : '',
      conciseMode: selected.conciseModeApplied === true
    });
  const guardedReplyText = preserveReplyText
    ? (trimForPaidLineMessage(normalizeText(selected.replyText)) || fallbackText)
    : (trimForPaidLineMessage(normalizeText(guardResult && guardResult.text) || fallbackText) || fallbackText);
  const readinessApplied = applyAnswerReadinessDecision({
    decision: readinessDecision,
    replyText: guardedReplyText,
    clarifyText: readinessClarifyText || 'まず対象手続きと期限を1つずつ教えてください。そこから次の一手を絞ります。',
    refuseText: 'この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを整理します。'
  });
  const replyText = trimForPaidLineMessage(readinessApplied.replyText) || fallbackText;
  const fallbackTemplateKind = guardResult && typeof guardResult.templateKind === 'string'
    ? guardResult.templateKind
    : classifyReplyTemplateKind({
      replyText: guardedReplyText,
      candidateKind: selected.kind || null,
      conciseModeApplied: selected.conciseModeApplied === true
    });
  const finalizerTemplateKind = classifyReplyTemplateKind({
    replyText,
    candidateKind: selected.kind || null,
    readinessDecision: readinessApplied.decision,
    conciseModeApplied: selected.conciseModeApplied === true
  });

  return {
    replyText,
    finalMeta: {
      legacyTemplateHit: guardResult ? guardResult.legacyTemplateHit === true : containsLegacyTemplateTerms(replyText),
      actionCount: guardResult && Number.isFinite(Number(guardResult.actionCount)) ? Number(guardResult.actionCount) : extractActionBullets(replyText).length,
      pitfallIncluded: guardResult ? guardResult.pitfallIncluded === true : /(詰まりやすい|注意|リスク|気をつけ|ボトルネック)/.test(replyText),
      followupQuestionIncluded: guardResult ? guardResult.followupQuestionIncluded === true : Boolean(extractFollowupQuestion(replyText)),
      committedNextActions: extractActionBullets(replyText),
      committedFollowupQuestion: extractFollowupQuestion(replyText),
      verificationOutcome,
      contradictionFlags: contradictionFlags.slice(0, 8),
      candidateId: selected.id || selected.kind || null,
      candidateKind: selected.kind || null,
      fallbackTemplateKind,
      finalizerTemplateKind,
      replyTemplateFingerprint: buildReplyTemplateFingerprint(replyText),
      readinessDecision: readinessApplied.decision,
      readinessSafeResponseMode,
      readinessEnforced: readinessApplied.enforced === true
    }
  };
}

module.exports = {
  finalizeCandidate
};
