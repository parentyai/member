'use strict';

const { sanitizePaidMainReply } = require('../conversation/paidReplyGuard');
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
  const atoms = selected.atoms && typeof selected.atoms === 'object' ? selected.atoms : {};

  const guardResult = sanitizePaidMainReply(selected.replyText, {
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
  const guardedReplyText = trimForPaidLineMessage(normalizeText(guardResult && guardResult.text) || fallbackText) || fallbackText;
  const readinessApplied = applyAnswerReadinessDecision({
    decision: readinessDecision,
    replyText: guardedReplyText,
    clarifyText: 'まず対象手続きと期限を1つずつ教えてください。そこから次の一手を絞ります。',
    refuseText: 'この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを整理します。'
  });
  const replyText = trimForPaidLineMessage(readinessApplied.replyText) || fallbackText;

  return {
    replyText,
    finalMeta: {
      legacyTemplateHit: guardResult ? guardResult.legacyTemplateHit === true : false,
      actionCount: guardResult && Number.isFinite(Number(guardResult.actionCount)) ? Number(guardResult.actionCount) : extractActionBullets(replyText).length,
      pitfallIncluded: guardResult ? guardResult.pitfallIncluded === true : false,
      followupQuestionIncluded: guardResult ? guardResult.followupQuestionIncluded === true : Boolean(extractFollowupQuestion(replyText)),
      committedNextActions: extractActionBullets(replyText),
      committedFollowupQuestion: extractFollowupQuestion(replyText),
      verificationOutcome,
      contradictionFlags: contradictionFlags.slice(0, 8),
      candidateId: selected.id || selected.kind || null,
      candidateKind: selected.kind || null,
      readinessDecision: readinessApplied.decision,
      readinessSafeResponseMode,
      readinessEnforced: readinessApplied.enforced === true
    }
  };
}

module.exports = {
  finalizeCandidate
};
