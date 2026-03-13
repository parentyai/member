'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function resolveObservedBoolean(payload, valueKey, observedKey) {
  const observedOverride = payload[observedKey];
  if (typeof observedOverride === 'boolean') {
    if (observedOverride !== true) return { value: null, observed: false };
    return {
      value: payload[valueKey] === true,
      observed: true
    };
  }
  if (typeof payload[valueKey] === 'boolean') {
    return {
      value: payload[valueKey] === true,
      observed: true
    };
  }
  return {
    value: null,
    observed: false
  };
}

function resolveObservedNumber(payload, valueKey, observedKey) {
  const numeric = clamp01(payload[valueKey]);
  const observedOverride = payload[observedKey];
  if (typeof observedOverride === 'boolean') {
    if (observedOverride !== true) {
      return { value: 0, observed: false };
    }
    return {
      value: numeric === null ? 0 : numeric,
      observed: numeric !== null
    };
  }
  if (numeric !== null) {
    return {
      value: numeric,
      observed: true
    };
  }
  return {
    value: 0,
    observed: false
  };
}

function normalizeRiskTier(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'high' || normalized === 'medium') return normalized;
  return 'low';
}

function normalizeSourceReadinessDecision(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'allow' || normalized === 'hedged' || normalized === 'clarify' || normalized === 'refuse') {
    return normalized;
  }
  return 'allow';
}

function normalizeReasonCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 12);
}

function resolveThresholds(intentRiskTier) {
  if (intentRiskTier === 'high') {
    return {
      minAuthorityAllow: 0.72,
      minFreshnessAllow: 0.72,
      minEvidenceAllow: 0.8,
      minAuthorityHedge: 0.62,
      minFreshnessHedge: 0.62,
      minEvidenceHedge: 0.62
    };
  }
  if (intentRiskTier === 'medium') {
    return {
      minAuthorityAllow: 0.58,
      minFreshnessAllow: 0.6,
      minEvidenceAllow: 0.58,
      minAuthorityHedge: 0.5,
      minFreshnessHedge: 0.52,
      minEvidenceHedge: 0.42
    };
  }
  return {
    minAuthorityAllow: 0.45,
    minFreshnessAllow: 0.5,
    minEvidenceAllow: 0.45,
    minAuthorityHedge: 0.38,
    minFreshnessHedge: 0.42,
    minEvidenceHedge: 0.3
  };
}

function resolveSafeResponseMode(decision) {
  if (decision === 'allow') return 'answer';
  if (decision === 'hedged') return 'answer_with_hedge';
  if (decision === 'clarify') return 'clarify';
  return 'refuse';
}

function evaluateAnswerReadiness(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lawfulBasis = normalizeText(payload.lawfulBasis).toLowerCase() || 'unspecified';
  const consentVerified = payload.consentVerified === true;
  const crossBorder = payload.crossBorder === true;
  const legalDecision = normalizeText(payload.legalDecision).toLowerCase();
  const entryType = normalizeText(payload.entryType).toLowerCase() || 'unknown';
  const compatContextActive = entryType === 'compat';
  const intentRiskTier = normalizeRiskTier(payload.intentRiskTier);
  const sourceAuthorityScore = clamp01(payload.sourceAuthorityScore);
  const sourceFreshnessScore = clamp01(payload.sourceFreshnessScore);
  const evidenceCoverageSignal = resolveObservedNumber(payload, 'evidenceCoverage', 'evidenceCoverageObserved');
  const evidenceCoverage = evidenceCoverageSignal.value;
  const evidenceCoverageObserved = evidenceCoverageSignal.observed;
  const sourceReadinessDecision = normalizeSourceReadinessDecision(payload.sourceReadinessDecision);
  const officialOnlySignal = resolveObservedBoolean(payload, 'officialOnlySatisfied', 'officialOnlySatisfiedObserved');
  const officialOnlySatisfied = officialOnlySignal.value === true;
  const officialOnlySatisfiedObserved = officialOnlySignal.observed;
  const unsupportedClaimCount = Math.max(0, Math.floor(Number.isFinite(Number(payload.unsupportedClaimCount)) ? Number(payload.unsupportedClaimCount) : 0));
  const contradictionDetected = payload.contradictionDetected === true;
  const requiredCoreFactsComplete = payload.requiredCoreFactsComplete !== false;
  const missingRequiredCoreFactsCount = Math.max(0, Math.floor(
    Number.isFinite(Number(payload.missingRequiredCoreFactsCount)) ? Number(payload.missingRequiredCoreFactsCount) : 0
  ));
  const requiredCoreFactsMissing = normalizeReasonCodes(payload.requiredCoreFactsMissing);
  const requiredCoreFactsDecision = normalizeSourceReadinessDecision(payload.requiredCoreFactsDecision);
  const requiredCoreFactsLogOnly = payload.requiredCoreFactsLogOnly === true;
  const fallbackType = normalizeText(payload.fallbackType).toLowerCase() || null;
  const reasonCodes = normalizeReasonCodes(payload.reasonCodes);
  const emergencyContextActive = payload.emergencyContextActive === true || payload.emergencyContext === true;
  const emergencySeverity = normalizeText(payload.emergencySeverity).toLowerCase() || null;
  const emergencyOfficialSourceSatisfied = payload.emergencyOfficialSourceSatisfied === true;
  const journeyContextActive = payload.journeyContextActive === true || payload.journeyContext === true;
  const journeyPhase = normalizeText(payload.journeyPhase).toLowerCase() || null;
  const taskBlockerDetected = payload.taskBlockerDetected === true || payload.taskBlockerContext === true;
  const journeyAlignedAction = typeof payload.journeyAlignedAction === 'boolean' ? payload.journeyAlignedAction : true;
  const cityPackGrounded = payload.cityPackGrounded === true;
  const cityPackAuthorityScore = clamp01(payload.cityPackAuthorityScore);
  const cityPackFreshnessScore = clamp01(payload.cityPackFreshnessScore);
  const savedFaqReused = payload.savedFaqReused === true;
  const savedFaqReusePass = payload.savedFaqReusePass === true;
  const savedFaqValid = typeof payload.savedFaqValid === 'boolean' ? payload.savedFaqValid : true;
  const savedFaqAllowedIntent = typeof payload.savedFaqAllowedIntent === 'boolean' ? payload.savedFaqAllowedIntent : true;
  const savedFaqAuthorityScore = clamp01(payload.savedFaqAuthorityScore);
  const crossSystemConflictDetected = payload.crossSystemConflictDetected === true;
  const thresholds = resolveThresholds(intentRiskTier);

  let decision = 'allow';
  const hasCityPackSignals = cityPackGrounded || cityPackAuthorityScore > 0 || cityPackFreshnessScore > 0;
  const optionalCityPackHedge = reasonCodes.includes('city_pack_optional_source_stale');
  const requiredCityPackBlocked = reasonCodes.includes('city_pack_required_source_blocked');
  const savedFaqHighRiskBlocked = savedFaqReused && intentRiskTier === 'high' && (
    savedFaqReusePass !== true
    || savedFaqValid !== true
    || savedFaqAllowedIntent !== true
    || savedFaqAuthorityScore < thresholds.minAuthorityAllow
    || sourceReadinessDecision !== 'allow'
    || evidenceCoverageObserved !== true
    || evidenceCoverage < thresholds.minEvidenceAllow
  );

  if (legalDecision === 'blocked' || (lawfulBasis === 'consent' && !consentVerified)) {
    decision = 'refuse';
    reasonCodes.push('legal_blocked');
  } else if (emergencyContextActive && emergencyOfficialSourceSatisfied !== true) {
    decision = 'refuse';
    reasonCodes.push('emergency_official_source_missing');
  } else if (requiredCityPackBlocked) {
    decision = 'refuse';
    reasonCodes.push('city_pack_required_source_blocked');
  } else if (sourceReadinessDecision === 'refuse') {
    decision = 'refuse';
    reasonCodes.push('source_readiness_refuse');
  } else if (intentRiskTier === 'high' && officialOnlySatisfiedObserved !== true) {
    decision = 'clarify';
    reasonCodes.push('official_only_signal_missing');
  } else if (intentRiskTier === 'high' && officialOnlySatisfied !== true) {
    decision = 'refuse';
    reasonCodes.push('official_only_not_satisfied');
  } else if (savedFaqHighRiskBlocked) {
    decision = 'refuse';
    reasonCodes.push('saved_faq_high_risk_not_ready');
  } else if (intentRiskTier === 'high' && evidenceCoverageObserved !== true) {
    decision = 'clarify';
    reasonCodes.push('evidence_coverage_signal_missing');
  } else if (intentRiskTier === 'high' && unsupportedClaimCount > 0 && evidenceCoverage < thresholds.minEvidenceHedge) {
    decision = 'refuse';
    reasonCodes.push('unsupported_claim_high_risk');
  } else if (requiredCoreFactsLogOnly !== true && requiredCoreFactsDecision === 'clarify') {
    decision = 'clarify';
    reasonCodes.push('missing_required_core_facts');
  } else if (requiredCoreFactsLogOnly !== true && requiredCoreFactsComplete !== true && missingRequiredCoreFactsCount >= 7) {
    decision = 'clarify';
    reasonCodes.push('missing_required_core_facts');
  } else if (taskBlockerDetected && journeyAlignedAction !== true) {
    decision = 'clarify';
    reasonCodes.push('journey_task_conflict');
  } else if (crossSystemConflictDetected) {
    decision = 'clarify';
    reasonCodes.push('cross_system_conflict_detected');
  } else if (contradictionDetected) {
    if (
      evidenceCoverage >= thresholds.minEvidenceAllow
      && sourceAuthorityScore >= thresholds.minAuthorityAllow
      && sourceFreshnessScore >= thresholds.minFreshnessAllow
    ) {
      decision = 'hedged';
      reasonCodes.push('contradiction_detected_hedged');
    } else {
      decision = 'clarify';
      reasonCodes.push('contradiction_detected');
    }
  } else if (sourceReadinessDecision === 'clarify') {
    decision = 'clarify';
    reasonCodes.push('source_readiness_clarify');
  } else if (sourceReadinessDecision === 'hedged') {
    decision = 'hedged';
    reasonCodes.push('source_readiness_hedged');
  } else {
    const allowReady = (
      sourceAuthorityScore >= thresholds.minAuthorityAllow
      && sourceFreshnessScore >= thresholds.minFreshnessAllow
      && evidenceCoverage >= thresholds.minEvidenceAllow
    );
    const hedgeReady = (
      sourceAuthorityScore >= thresholds.minAuthorityHedge
      && sourceFreshnessScore >= thresholds.minFreshnessHedge
      && evidenceCoverage >= thresholds.minEvidenceHedge
    );
    if (allowReady) {
      decision = 'allow';
      reasonCodes.push('readiness_allow');
    } else if (hedgeReady) {
      decision = 'hedged';
      reasonCodes.push('readiness_hedged');
    } else {
      decision = 'clarify';
      reasonCodes.push('readiness_clarify');
    }
  }

  if (optionalCityPackHedge && decision === 'allow') {
    decision = 'hedged';
    reasonCodes.push('city_pack_optional_source_stale');
  }
  if (
    decision === 'allow'
    && hasCityPackSignals
    && (
      cityPackAuthorityScore > 0 && cityPackAuthorityScore < thresholds.minAuthorityHedge
      || cityPackFreshnessScore > 0 && cityPackFreshnessScore < thresholds.minFreshnessHedge
    )
  ) {
    decision = 'hedged';
    reasonCodes.push('city_pack_signal_hedged');
  }
  if (decision === 'allow' && savedFaqReused && savedFaqReusePass !== true && intentRiskTier !== 'high') {
    decision = 'hedged';
    reasonCodes.push('saved_faq_reuse_hedged');
  }
  if (
    compatContextActive
    && intentRiskTier === 'high'
    && decision !== 'refuse'
    && (
      officialOnlySatisfiedObserved !== true
      || evidenceCoverageObserved !== true
      || sourceReadinessDecision !== 'allow'
    )
  ) {
    decision = 'clarify';
    reasonCodes.push('compat_high_risk_policy_tightened');
  }
  if (crossBorder) reasonCodes.push('cross_border_enabled');
  if (fallbackType) reasonCodes.push('fallback_applied');
  if (emergencyContextActive) reasonCodes.push('emergency_context_active');
  if (journeyContextActive) reasonCodes.push('journey_context_active');

  const normalizedReasonCodes = normalizeReasonCodes(reasonCodes);
  return {
    decision,
    reasonCodes: normalizedReasonCodes,
    qualitySnapshot: {
      intentRiskTier,
      lawfulBasis,
      consentVerified,
      crossBorder,
      legalDecision: legalDecision || null,
      entryType,
      compatContextActive,
      sourceAuthorityScore,
      sourceFreshnessScore,
      sourceReadinessDecision,
      officialOnlySatisfied: officialOnlySatisfied === true,
      officialOnlySatisfiedObserved,
      requiredCoreFactsComplete: requiredCoreFactsComplete === true,
      missingRequiredCoreFactsCount,
      requiredCoreFactsMissing,
      requiredCoreFactsDecision,
      requiredCoreFactsLogOnly,
      unsupportedClaimCount,
      contradictionDetected,
      evidenceCoverage,
      evidenceCoverageObserved,
      fallbackType,
      emergencyContextActive,
      emergencySeverity,
      emergencyOfficialSourceSatisfied,
      journeyContextActive,
      journeyPhase,
      taskBlockerDetected,
      journeyAlignedAction,
      cityPackGrounded,
      cityPackAuthorityScore,
      cityPackFreshnessScore,
      savedFaqReused,
      savedFaqReusePass,
      savedFaqValid,
      savedFaqAllowedIntent,
      savedFaqAuthorityScore,
      crossSystemConflictDetected,
      policyTighteningVersion: 'r827'
    },
    safeResponseMode: resolveSafeResponseMode(decision)
  };
}

module.exports = {
  evaluateAnswerReadiness
};
