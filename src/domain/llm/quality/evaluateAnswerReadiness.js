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
  const requestedCityKey = normalizeText(payload.requestedCityKey).toLowerCase() || null;
  const matchedCityKey = normalizeText(payload.matchedCityKey).toLowerCase() || null;
  const citySpecificitySatisfied = payload.citySpecificitySatisfied === true;
  const citySpecificityReason = normalizeText(payload.citySpecificityReason).toLowerCase() || null;
  const scopeDisclosureRequired = payload.scopeDisclosureRequired === true;
  const knowledgeScope = normalizeText(payload.knowledgeScope).toLowerCase() || 'none';
  const savedFaqReused = payload.savedFaqReused === true;
  const savedFaqReusePass = payload.savedFaqReusePass === true;
  const savedFaqValid = typeof payload.savedFaqValid === 'boolean' ? payload.savedFaqValid : true;
  const savedFaqAllowedIntent = typeof payload.savedFaqAllowedIntent === 'boolean' ? payload.savedFaqAllowedIntent : true;
  const savedFaqAuthorityScore = clamp01(payload.savedFaqAuthorityScore);
  const crossSystemConflictDetected = payload.crossSystemConflictDetected === true;
  const thresholds = resolveThresholds(intentRiskTier);
  const highRisk = intentRiskTier === 'high';
  const mediumRisk = intentRiskTier === 'medium';
  const cityScopedRequest = knowledgeScope === 'city' || Boolean(requestedCityKey);

  let decision = 'allow';
  let decisionSource = 'threshold_allow';
  function applyDecision(nextDecision, reasonCode, source) {
    decision = nextDecision;
    if (reasonCode) reasonCodes.push(reasonCode);
    if (source) decisionSource = source;
  }
  const hasCityPackSignals = cityPackGrounded || cityPackAuthorityScore > 0 || cityPackFreshnessScore > 0;
  const optionalCityPackHedge = reasonCodes.includes('city_pack_optional_source_stale');
  const requiredCityPackBlocked = reasonCodes.includes('city_pack_required_source_blocked');
  const savedFaqHighRiskBlocked = savedFaqReused && highRisk && (
    savedFaqReusePass !== true
    || savedFaqValid !== true
    || savedFaqAllowedIntent !== true
    || savedFaqAuthorityScore < thresholds.minAuthorityAllow
    || sourceReadinessDecision !== 'allow'
    || evidenceCoverageObserved !== true
    || evidenceCoverage < thresholds.minEvidenceAllow
  );

  if (legalDecision === 'blocked' || (lawfulBasis === 'consent' && !consentVerified)) {
    applyDecision('refuse', 'legal_blocked', 'legal_policy_guard');
  } else if (emergencyContextActive && emergencyOfficialSourceSatisfied !== true) {
    applyDecision('refuse', 'emergency_official_source_missing', 'emergency_official_source_guard');
  } else if (requiredCityPackBlocked) {
    applyDecision('refuse', 'city_pack_required_source_blocked', 'city_pack_required_source_guard');
  } else if (highRisk && cityScopedRequest && citySpecificitySatisfied !== true) {
    applyDecision('clarify', 'official_or_specificity_not_satisfied', 'high_risk_city_specificity_guard');
  } else if (sourceReadinessDecision === 'refuse') {
    applyDecision('refuse', 'source_readiness_refuse', 'source_readiness_guard');
  } else if (highRisk && officialOnlySatisfiedObserved !== true) {
    applyDecision('clarify', 'official_only_signal_missing', 'high_risk_official_signal_guard');
  } else if (highRisk && officialOnlySatisfied !== true) {
    applyDecision('refuse', 'official_only_not_satisfied', 'high_risk_official_policy_guard');
  } else if (savedFaqHighRiskBlocked) {
    applyDecision('refuse', 'saved_faq_high_risk_not_ready', 'high_risk_saved_faq_guard');
  } else if (highRisk && evidenceCoverageObserved !== true) {
    applyDecision('clarify', 'evidence_coverage_signal_missing', 'high_risk_evidence_signal_guard');
  } else if (highRisk && unsupportedClaimCount > 0 && evidenceCoverage < thresholds.minEvidenceHedge) {
    applyDecision('refuse', 'unsupported_claim_high_risk', 'high_risk_unsupported_claim_guard');
  } else if (requiredCoreFactsLogOnly !== true && requiredCoreFactsDecision === 'clarify') {
    applyDecision('clarify', 'missing_required_core_facts', 'required_core_facts_guard');
  } else if (requiredCoreFactsLogOnly !== true && requiredCoreFactsComplete !== true && missingRequiredCoreFactsCount >= 7) {
    applyDecision('clarify', 'missing_required_core_facts', 'required_core_facts_guard');
  } else if (taskBlockerDetected && journeyAlignedAction !== true) {
    applyDecision('clarify', 'journey_task_conflict', 'journey_task_conflict_guard');
  } else if (crossSystemConflictDetected) {
    applyDecision('clarify', 'cross_system_conflict_detected', 'cross_system_conflict_guard');
  } else if (contradictionDetected) {
    if (
      evidenceCoverage >= thresholds.minEvidenceAllow
      && sourceAuthorityScore >= thresholds.minAuthorityAllow
      && sourceFreshnessScore >= thresholds.minFreshnessAllow
    ) {
      applyDecision('hedged', 'contradiction_detected_hedged', 'contradiction_guard');
    } else {
      applyDecision('clarify', 'contradiction_detected', 'contradiction_guard');
    }
  } else if (sourceReadinessDecision === 'clarify') {
    applyDecision('clarify', 'source_readiness_clarify', 'source_readiness_guard');
  } else if (sourceReadinessDecision === 'hedged') {
    applyDecision('hedged', 'source_readiness_hedged', 'source_readiness_guard');
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
      applyDecision('allow', 'readiness_allow', 'threshold_allow');
    } else if (hedgeReady) {
      applyDecision('hedged', 'readiness_hedged', 'threshold_hedged');
    } else {
      applyDecision('clarify', 'readiness_clarify', 'threshold_clarify');
    }
  }

  if (
    decision === 'allow'
    && mediumRisk
    && cityScopedRequest
    && citySpecificitySatisfied !== true
  ) {
    applyDecision('hedged', 'city_specificity_not_satisfied', 'medium_risk_city_specificity_guard');
  }
  if (
    decision === 'allow'
    && !highRisk
    && !mediumRisk
    && cityScopedRequest
    && citySpecificitySatisfied !== true
  ) {
    applyDecision('hedged', 'city_specificity_not_satisfied', 'low_risk_city_specificity_guard');
  }
  if (optionalCityPackHedge && decision === 'allow') {
    applyDecision('hedged', 'city_pack_optional_source_stale', 'city_pack_optional_source_guard');
  }
  if (
    decision === 'allow'
    && hasCityPackSignals
    && (
      cityPackAuthorityScore > 0 && cityPackAuthorityScore < thresholds.minAuthorityHedge
      || cityPackFreshnessScore > 0 && cityPackFreshnessScore < thresholds.minFreshnessHedge
    )
  ) {
    applyDecision('hedged', 'city_pack_signal_hedged', 'city_pack_signal_guard');
  }
  if (decision === 'allow' && savedFaqReused && savedFaqReusePass !== true && intentRiskTier !== 'high') {
    applyDecision('hedged', 'saved_faq_reuse_hedged', 'saved_faq_reuse_guard');
  }

  const evidenceBelowAllow = evidenceCoverageObserved === true && evidenceCoverage < thresholds.minEvidenceAllow;
  const mediumRiskOfficialWeak = mediumRisk && officialOnlySatisfiedObserved === true && officialOnlySatisfied !== true;
  const mediumRiskSavedFaqWeak = mediumRisk && savedFaqReused && savedFaqReusePass !== true;
  const journeyAlignmentWeak = journeyContextActive && journeyAlignedAction === false;

  if (decision === 'hedged' && highRisk && evidenceBelowAllow) {
    applyDecision('clarify', 'high_risk_evidence_not_ready', 'high_risk_evidence_guard');
  }
  if (decision === 'hedged' && mediumRisk && evidenceBelowAllow && unsupportedClaimCount > 0) {
    applyDecision('clarify', 'medium_risk_evidence_not_ready', 'medium_risk_evidence_guard');
  }
  if (
    decision !== 'refuse'
    && mediumRiskOfficialWeak
    && (
      decision === 'allow'
      || evidenceBelowAllow
      || sourceReadinessDecision !== 'allow'
      || mediumRiskSavedFaqWeak
    )
  ) {
    applyDecision('clarify', 'medium_risk_official_not_ready', 'medium_risk_official_guard');
  }
  if (
    decision !== 'refuse'
    && mediumRiskSavedFaqWeak
    && (
      decision === 'allow'
      || decision === 'hedged'
      || evidenceBelowAllow
      || sourceReadinessDecision !== 'allow'
      || mediumRiskOfficialWeak
    )
  ) {
    applyDecision('clarify', 'saved_faq_reuse_not_ready', 'saved_faq_reuse_guard');
  }
  if (decision !== 'refuse' && decision !== 'clarify' && journeyAlignmentWeak && intentRiskTier !== 'low') {
    applyDecision('clarify', 'journey_alignment_not_ready', 'journey_alignment_guard');
  }
  if (
    compatContextActive
    && highRisk
    && decision !== 'refuse'
    && (
      officialOnlySatisfiedObserved !== true
      || evidenceCoverageObserved !== true
      || sourceReadinessDecision !== 'allow'
    )
  ) {
    applyDecision('clarify', 'compat_high_risk_policy_tightened', 'compat_high_risk_policy_guard');
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
      requestedCityKey,
      matchedCityKey,
      citySpecificitySatisfied,
      citySpecificityReason,
      scopeDisclosureRequired,
      knowledgeScope,
      cityPackAuthorityScore,
      cityPackFreshnessScore,
      savedFaqReused,
      savedFaqReusePass,
      savedFaqValid,
      savedFaqAllowedIntent,
      savedFaqAuthorityScore,
      crossSystemConflictDetected,
      policyTighteningVersion: 'r827',
      readinessHardeningVersion: 'r830',
      decisionSource
    },
    safeResponseMode: resolveSafeResponseMode(decision),
    decisionSource
  };
}

module.exports = {
  evaluateAnswerReadiness
};
