'use strict';

const {
  COLD_TONE_PATTERNS,
  SOFT_TONE_PATTERNS
} = require('../constants');
const {
  normalizeText,
  countPatternMatches,
  createSupportingSignal
} = require('../scoreHelpers');

function evaluateToneSafetySignals(reviewUnit) {
  const replyText = normalizeText(reviewUnit && reviewUnit.assistantReply && reviewUnit.assistantReply.text);
  if (!replyText) {
    return {
      penalty: 0,
      bonus: 0,
      supportingSignals: []
    };
  }

  const supportingSignals = [];
  const coldToneHits = countPatternMatches(replyText, COLD_TONE_PATTERNS);
  const softToneHits = countPatternMatches(replyText, SOFT_TONE_PATTERNS);

  if (coldToneHits > 0) {
    supportingSignals.push(createSupportingSignal(
      'cold_tone_phrase_detected',
      'negative',
      'assistant reply contains a cold or dismissive closing phrase',
      { count: coldToneHits }
    ));
  }
  if (softToneHits > 0) {
    supportingSignals.push(createSupportingSignal(
      'soft_tone_phrase_detected',
      'positive',
      'assistant reply contains a softener that reduces service harshness',
      { count: softToneHits }
    ));
  }

  return {
    penalty: Math.min(0.2, coldToneHits * 0.12),
    bonus: Math.min(0.12, softToneHits * 0.06),
    supportingSignals
  };
}

module.exports = {
  evaluateToneSafetySignals
};
