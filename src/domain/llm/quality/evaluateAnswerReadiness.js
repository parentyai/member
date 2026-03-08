'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
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
      minEvidenceAllow: 0.72,
      minAuthorityHedge: 0.62,
      minFreshnessHedge: 0.62,
      minEvidenceHedge: 0.55
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
  const intentRiskTier = normalizeRiskTier(payload.intentRiskTier);
  const sourceAuthorityScore = clamp01(payload.sourceAuthorityScore);
  const sourceFreshnessScore = clamp01(payload.sourceFreshnessScore);
  const evidenceCoverage = clamp01(payload.evidenceCoverage);
  const sourceReadinessDecision = normalizeSourceReadinessDecision(payload.sourceReadinessDecision);
  const officialOnlySatisfied = payload.officialOnlySatisfied !== false;
  const unsupportedClaimCount = Math.max(0, Math.floor(Number.isFinite(Number(payload.unsupportedClaimCount)) ? Number(payload.unsupportedClaimCount) : 0));
  const contradictionDetected = payload.contradictionDetected === true;
  const fallbackType = normalizeText(payload.fallbackType).toLowerCase() || null;
  const reasonCodes = normalizeReasonCodes(payload.reasonCodes);
  const thresholds = resolveThresholds(intentRiskTier);

  let decision = 'allow';

  if (legalDecision === 'blocked' || (lawfulBasis === 'consent' && !consentVerified)) {
    decision = 'refuse';
    reasonCodes.push('legal_blocked');
  } else if (intentRiskTier === 'high' && officialOnlySatisfied !== true) {
    decision = 'refuse';
    reasonCodes.push('official_only_not_satisfied');
  } else if (sourceReadinessDecision === 'refuse') {
    decision = 'refuse';
    reasonCodes.push('source_readiness_refuse');
  } else if (intentRiskTier === 'high' && unsupportedClaimCount > 0 && evidenceCoverage < thresholds.minEvidenceHedge) {
    decision = 'refuse';
    reasonCodes.push('unsupported_claim_high_risk');
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

  if (crossBorder) reasonCodes.push('cross_border_enabled');
  if (fallbackType) reasonCodes.push('fallback_applied');

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
      sourceAuthorityScore,
      sourceFreshnessScore,
      sourceReadinessDecision,
      officialOnlySatisfied: officialOnlySatisfied === true,
      unsupportedClaimCount,
      contradictionDetected,
      evidenceCoverage,
      fallbackType
    },
    safeResponseMode: resolveSafeResponseMode(decision)
  };
}

module.exports = {
  evaluateAnswerReadiness
};
