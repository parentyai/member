'use strict';

const {
  SIGNAL_THRESHOLDS,
  GENERIC_TEMPLATE_TOKENS,
  GENERIC_FALLBACK_PATTERNS
} = require('../constants');
const {
  SIGNAL_STATUS,
  normalizeText,
  clamp01,
  createSupportingSignal,
  buildQualityStatus,
  countPatternMatches,
  includesTemplateToken
} = require('../scoreHelpers');

function collectSentences(text) {
  return normalizeText(text)
    .split(/[。！？\n]/u)
    .map((value) => value.trim())
    .filter(Boolean);
}

function evaluateNaturalnessSignals(reviewUnit, deps) {
  const replyText = normalizeText(reviewUnit && reviewUnit.assistantReply && reviewUnit.assistantReply.text);
  if (!replyText) {
    return {
      value: 0,
      status: SIGNAL_STATUS.BLOCKED,
      supportingSignals: [
        createSupportingSignal('missing_assistant_reply_for_naturalness', 'blocked', 'assistant reply text is required for naturalness evaluation')
      ],
      blockers: []
    };
  }

  const toneSafety = deps && deps.toneSafety ? deps.toneSafety : { penalty: 0, bonus: 0, supportingSignals: [] };
  const supportingSignals = [];
  let score = 0.92;

  const genericPhraseHits = countPatternMatches(replyText, GENERIC_FALLBACK_PATTERNS);
  if (genericPhraseHits > 0) {
    score -= Math.min(0.24, genericPhraseHits * 0.12);
    supportingSignals.push(createSupportingSignal(
      'generic_fallback_phrase_detected',
      'negative',
      'assistant reply contains a visibly generic fallback phrase',
      { count: genericPhraseHits }
    ));
  }

  const templateKinds = [
    reviewUnit && reviewUnit.telemetrySignals && reviewUnit.telemetrySignals.fallbackTemplateKind,
    reviewUnit && reviewUnit.telemetrySignals && reviewUnit.telemetrySignals.finalizerTemplateKind
  ];
  if (templateKinds.some((value) => includesTemplateToken(value, GENERIC_TEMPLATE_TOKENS))) {
    score -= 0.16;
    supportingSignals.push(createSupportingSignal(
      'generic_template_kind_observed',
      'negative',
      'fallback or finalizer template kind points to a generic template'
    ));
  }

  const sentences = collectSentences(replyText);
  if (sentences.length >= 3) {
    const endings = sentences.map((sentence) => sentence.slice(-2));
    const dominantEnding = endings[0];
    const repeatedEndingCount = endings.filter((value) => value === dominantEnding).length;
    if (repeatedEndingCount / endings.length >= 0.75) {
      score -= 0.14;
      supportingSignals.push(createSupportingSignal(
        'repeated_sentence_ending',
        'negative',
        'most sentences use the same ending, which increases template-like feel',
        { repeatedEndingCount, sentenceCount: endings.length }
      ));
    }
  }

  score = clamp01(score - toneSafety.penalty + toneSafety.bonus);
  if (score >= 0.75) {
    supportingSignals.push(createSupportingSignal(
      'naturalness_text_sufficient',
      'positive',
      'assistant reply has enough variation to evaluate naturalness positively'
    ));
  }

  return {
    value: score,
    status: buildQualityStatus(score, SIGNAL_THRESHOLDS.naturalness),
    supportingSignals: supportingSignals.concat(Array.isArray(toneSafety.supportingSignals) ? toneSafety.supportingSignals : []),
    blockers: []
  };
}

module.exports = {
  evaluateNaturalnessSignals
};
