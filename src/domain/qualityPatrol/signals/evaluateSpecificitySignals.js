'use strict';

const {
  SIGNAL_THRESHOLDS,
  GENERIC_TEMPLATE_TOKENS,
  ABSTRACT_EXPLANATION_PATTERNS,
  CITY_KEYWORDS,
  HOUSING_KEYWORDS
} = require('../constants');
const {
  SIGNAL_STATUS,
  normalizeText,
  clamp01,
  createSupportingSignal,
  buildQualityStatus,
  tokenOverlap,
  countPatternMatches,
  includesTemplateToken
} = require('../scoreHelpers');

function includesKeyword(text, keywords) {
  const source = normalizeText(text).toLowerCase();
  return Array.isArray(keywords) && keywords.some((keyword) => source.includes(String(keyword || '').toLowerCase()));
}

function evaluateSpecificitySignals(reviewUnit) {
  const userText = normalizeText(reviewUnit && reviewUnit.userMessage && reviewUnit.userMessage.text);
  const replyText = normalizeText(reviewUnit && reviewUnit.assistantReply && reviewUnit.assistantReply.text);
  if (!userText || !replyText) {
    return {
      value: 0,
      status: SIGNAL_STATUS.BLOCKED,
      supportingSignals: [
        createSupportingSignal('missing_text_for_specificity', 'blocked', 'user and assistant text are both required for specificity evaluation')
      ],
      blockers: []
    };
  }

  const telemetry = reviewUnit && reviewUnit.telemetrySignals ? reviewUnit.telemetrySignals : {};
  const overlap = tokenOverlap(userText, replyText);
  const supportingSignals = [];
  let score = 0.28 + Math.min(0.32, overlap.ratio * 0.45);

  if (overlap.overlap.length > 0) {
    supportingSignals.push(createSupportingSignal(
      'user_reply_token_overlap',
      'positive',
      'assistant reply reuses meaningful tokens from the user question',
      { overlap: overlap.overlap.slice(0, 6) }
    ));
  } else {
    supportingSignals.push(createSupportingSignal(
      'user_reply_token_overlap_missing',
      'negative',
      'assistant reply does not visibly ground itself in user wording'
    ));
    score -= 0.14;
  }

  if (reviewUnit && reviewUnit.slice === 'city') {
    if (telemetry.cityPackUsedInAnswer === true || includesKeyword(replyText, CITY_KEYWORDS)) {
      score += 0.22;
      supportingSignals.push(createSupportingSignal('city_grounding_visible', 'positive', 'city-specific grounding is visible in the answer'));
    } else {
      score -= 0.22;
      supportingSignals.push(createSupportingSignal('city_grounding_missing', 'negative', 'city slice lacks concrete city grounding in the answer'));
    }
  }

  if (reviewUnit && reviewUnit.slice === 'housing') {
    if (includesKeyword(replyText, HOUSING_KEYWORDS)) {
      score += 0.18;
      supportingSignals.push(createSupportingSignal('housing_terms_present', 'positive', 'housing-specific terms are present in the answer'));
    } else {
      score -= 0.18;
      supportingSignals.push(createSupportingSignal('housing_terms_missing', 'negative', 'housing slice answer stays generic'));
    }
  }

  if (reviewUnit && reviewUnit.slice === 'broad' && includesTemplateToken(telemetry.fallbackTemplateKind, GENERIC_TEMPLATE_TOKENS)) {
    score -= 0.12;
    supportingSignals.push(createSupportingSignal(
      'broad_generic_fallback_template',
      'negative',
      'broad slice answer leans on a generic fallback template'
    ));
  }

  const abstractHits = countPatternMatches(replyText, ABSTRACT_EXPLANATION_PATTERNS);
  if (abstractHits > 0) {
    score -= Math.min(0.18, abstractHits * 0.09);
    supportingSignals.push(createSupportingSignal(
      'abstract_explanation_phrase_detected',
      'negative',
      'assistant reply falls back to abstract explanation phrases',
      { count: abstractHits }
    ));
  }

  score = clamp01(score);
  return {
    value: score,
    status: buildQualityStatus(score, SIGNAL_THRESHOLDS.specificity),
    supportingSignals,
    blockers: []
  };
}

module.exports = {
  evaluateSpecificitySignals
};
