'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function hasFinite(value) {
  return Number.isFinite(Number(value));
}

function hasPositiveFinite(value) {
  return hasFinite(value) && Number(value) > 0;
}

function clamp01(value) {
  if (!hasFinite(value)) return null;
  const numeric = Number(value);
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
}

function normalizeReasonCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  return rows
    .map((item) => normalizeText(item).toLowerCase())
    .filter(Boolean);
}

function inferEvidenceCoverage(payload) {
  const explicit = clamp01(payload.evidenceCoverage);
  if (explicit !== null) {
    return {
      evidenceCoverage: explicit,
      evidenceCoverageObserved: true
    };
  }

  const assistantQuality = payload.assistantQuality && typeof payload.assistantQuality === 'object'
    ? payload.assistantQuality
    : {};
  const assistantCoverage = clamp01(assistantQuality.evidenceCoverage);
  if (assistantCoverage !== null) {
    return {
      evidenceCoverage: assistantCoverage,
      evidenceCoverageObserved: true
    };
  }

  const evidenceOutcome = normalizeText(payload.evidenceOutcome).toUpperCase();
  const evidenceNeed = normalizeText(payload.evidenceNeed).toLowerCase();
  const citationRanks = Array.isArray(payload.citationRanks) ? payload.citationRanks : [];
  const urlCount = Number(payload.urlCount);
  if (evidenceOutcome === 'SUPPORTED') {
    const hasConcreteEvidence = citationRanks.length > 0 || (Number.isFinite(urlCount) && urlCount > 0);
    return {
      evidenceCoverage: hasConcreteEvidence || evidenceNeed === 'none' ? 1 : 0.5,
      evidenceCoverageObserved: true
    };
  }

  if (evidenceOutcome === 'BLOCKED') {
    return {
      evidenceCoverage: 0,
      evidenceCoverageObserved: true
    };
  }

  return {
    evidenceCoverage: null,
    evidenceCoverageObserved: false
  };
}

function resolveTelemetryCoverageSignals(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const sourceReadinessDecision = normalizeText(payload.sourceReadinessDecision).toLowerCase();
  const sourceReadinessReasons = normalizeReasonCodes(payload.sourceReadinessReasons);
  const matchedArticleIds = Array.isArray(payload.matchedArticleIds) ? payload.matchedArticleIds : [];
  const blockedReason = normalizeText(payload.blockedReason);
  const cityPackValidation = payload.cityPackValidation && typeof payload.cityPackValidation === 'object'
    ? payload.cityPackValidation
    : null;
  const { evidenceCoverage, evidenceCoverageObserved } = inferEvidenceCoverage(payload);

  const officialOnlyObserved = typeof payload.officialOnlySatisfied === 'boolean';

  const cityPackObserved = typeof payload.cityPackGrounded === 'boolean'
    || hasPositiveFinite(payload.cityPackFreshnessScore)
    || hasPositiveFinite(payload.cityPackAuthorityScore)
    || normalizeText(payload.cityPackPackId).length > 0
    || normalizeText(payload.cityPackSourceReadinessDecision).length > 0
    || (cityPackValidation && Array.isArray(cityPackValidation.sourceRefs) && cityPackValidation.sourceRefs.length > 0);

  const sourceFreshnessScore = clamp01(payload.sourceFreshnessScore);
  const cityPackFreshnessScore = clamp01(payload.cityPackFreshnessScore);
  const freshnessCandidates = [sourceFreshnessScore, cityPackFreshnessScore].filter((value) => value !== null);
  const lowestFreshnessScore = freshnessCandidates.length > 0 ? Math.min(...freshnessCandidates) : null;
  const staleSignalObserved = typeof payload.staleSourceBlocked === 'boolean'
    || (cityPackValidation && typeof cityPackValidation.blocked === 'boolean')
    || (lowestFreshnessScore !== null && lowestFreshnessScore < 0.6);
  const staleSourceBlocked = typeof payload.staleSourceBlocked === 'boolean'
    ? payload.staleSourceBlocked
    : cityPackValidation && typeof cityPackValidation.blocked === 'boolean'
      ? cityPackValidation.blocked
      : lowestFreshnessScore !== null && lowestFreshnessScore < 0.6
        ? (
          sourceReadinessDecision === 'hedged'
          || sourceReadinessDecision === 'clarify'
          || sourceReadinessDecision === 'refuse'
          || sourceReadinessReasons.some((item) => item.includes('stale') || item.includes('freshness'))
        )
        : null;

  const emergencyObserved = typeof payload.emergencyOfficialSourceSatisfied === 'boolean';
  const emergencyOverrideObserved = typeof payload.emergencyOverrideApplied === 'boolean';

  const journeyObserved = typeof payload.journeyAlignedAction === 'boolean';

  const savedFaqObserved = typeof payload.savedFaqReusePass === 'boolean'
    || matchedArticleIds.length > 0;
  const savedFaqReusePass = typeof payload.savedFaqReusePass === 'boolean'
    ? payload.savedFaqReusePass
    : matchedArticleIds.length > 0
      ? blockedReason.length === 0
      : null;

  return {
    evidenceCoverage,
    evidenceCoverageObserved,
    officialOnlySatisfiedObserved: officialOnlyObserved,
    cityPackGroundedObserved: cityPackObserved,
    staleSourceBlocked,
    staleSourceBlockedObserved: staleSignalObserved === true,
    emergencyOfficialSourceSatisfiedObserved: emergencyObserved,
    emergencyOverrideAppliedObserved: emergencyOverrideObserved,
    journeyAlignedActionObserved: journeyObserved,
    savedFaqReusePass,
    savedFaqReusePassObserved: savedFaqObserved
  };
}

module.exports = {
  resolveTelemetryCoverageSignals
};
