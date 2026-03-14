'use strict';

const {
  SIGNAL_THRESHOLDS,
  GENERIC_TEMPLATE_TOKENS
} = require('../constants');
const {
  SIGNAL_STATUS,
  normalizeText,
  clamp01,
  createSupportingSignal,
  buildRiskStatus,
  includesTemplateToken
} = require('../scoreHelpers');

function evaluateFallbackRepetitionSignals(reviewUnit) {
  const telemetry = reviewUnit && reviewUnit.telemetrySignals ? reviewUnit.telemetrySignals : {};
  const fingerprint = normalizeText(telemetry.replyTemplateFingerprint);
  const applicable = Boolean(
    normalizeText(telemetry.genericFallbackSlice)
    || normalizeText(telemetry.fallbackTemplateKind)
    || normalizeText(telemetry.finalizerTemplateKind)
    || fingerprint
    || Number.isFinite(Number(telemetry.repeatRiskScore))
  );

  if (!applicable) {
    return {
      value: 0,
      status: SIGNAL_STATUS.UNAVAILABLE,
      supportingSignals: [
        createSupportingSignal('fallback_repetition_not_observed', 'neutral', 'fallback repetition signals are not present for this review unit')
      ],
      blockers: []
    };
  }

  const supportingSignals = [];
  let risk = 0;

  if (includesTemplateToken(telemetry.fallbackTemplateKind, GENERIC_TEMPLATE_TOKENS)) {
    risk += 0.28;
    supportingSignals.push(createSupportingSignal(
      'generic_fallback_template_kind',
      'negative',
      'fallback template kind increases repetition risk'
    ));
  }

  if (includesTemplateToken(telemetry.finalizerTemplateKind, GENERIC_TEMPLATE_TOKENS)) {
    risk += 0.16;
    supportingSignals.push(createSupportingSignal(
      'generic_finalizer_template_kind',
      'negative',
      'finalizer template kind increases repetition risk'
    ));
  }

  if (normalizeText(telemetry.genericFallbackSlice)) {
    risk += 0.12;
    supportingSignals.push(createSupportingSignal(
      'generic_fallback_slice_present',
      'negative',
      'generic fallback slice is present for this reply'
    ));
  }

  if (fingerprint) {
    risk += 0.14;
    supportingSignals.push(createSupportingSignal(
      'reply_template_fingerprint_present',
      'negative',
      'stable reply template fingerprint makes repeat patterns trackable'
    ));
  }

  if (Number.isFinite(Number(telemetry.repeatRiskScore))) {
    const repeatRiskScore = clamp01(telemetry.repeatRiskScore);
    risk += repeatRiskScore * 0.4;
    supportingSignals.push(createSupportingSignal(
      'repeat_risk_score_present',
      repeatRiskScore >= 0.5 ? 'negative' : 'neutral',
      'telemetry contributes a repeat-risk score',
      { value: repeatRiskScore }
    ));
  }

  if (telemetry.repetitionPrevented === true) {
    risk -= 0.1;
    supportingSignals.push(createSupportingSignal(
      'repetition_prevented',
      'positive',
      'telemetry shows repetition prevention was applied'
    ));
  }

  risk = clamp01(risk);
  return {
    value: risk,
    status: buildRiskStatus(risk, SIGNAL_THRESHOLDS.fallbackRepetition),
    supportingSignals,
    blockers: []
  };
}

module.exports = {
  evaluateFallbackRepetitionSignals
};
