'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return null;
}

function normalizeRiskTier(value) {
  const tier = normalizeText(value);
  if (tier === 'high' || tier === 'medium') return tier;
  return 'low';
}

function resolveThresholds(intentRiskTier) {
  if (intentRiskTier === 'high') {
    return {
      minAuthority: 0.72,
      minFreshness: 0.72,
      officialOnlyRequired: true
    };
  }
  if (intentRiskTier === 'medium') {
    return {
      minAuthority: 0.58,
      minFreshness: 0.6,
      officialOnlyRequired: false
    };
  }
  return {
    minAuthority: 0.45,
    minFreshness: 0.5,
    officialOnlyRequired: false
  };
}

function sourceTypeScore(value) {
  const sourceType = normalizeText(value);
  if (sourceType === 'official') return 1;
  if (sourceType === 'semi_official') return 0.85;
  if (sourceType === 'community') return 0.4;
  if (sourceType === 'other') return 0.45;
  return 0.72;
}

function authorityLevelScore(value) {
  const level = normalizeText(value);
  if (level === 'federal') return 1;
  if (level === 'state') return 0.9;
  if (level === 'local') return 0.8;
  if (level === 'other') return 0.55;
  return 0.7;
}

function statusScore(value) {
  const status = normalizeText(value);
  if (!status || status === 'active') return 1;
  if (status === 'needs_review') return 0.72;
  if (status === 'retired') return 0.2;
  if (status === 'blocked' || status === 'dead') return 0;
  return 0.5;
}

function freshnessScore(validUntilMs, nowMs) {
  if (!Number.isFinite(validUntilMs)) return 0.62;
  const remainingMs = validUntilMs - nowMs;
  if (remainingMs <= 0) return 0;
  const remainingDays = remainingMs / (24 * 60 * 60 * 1000);
  if (remainingDays <= 7) return 0.45;
  if (remainingDays <= 30) return 0.68;
  if (remainingDays <= 120) return 0.88;
  return 1;
}

function normalizeCandidates(value) {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        sourceType: normalizeText(item.sourceType),
        authorityLevel: normalizeText(item.authorityLevel),
        status: normalizeText(item.status),
        validUntilMs: toMillis(item.validUntil),
        requiredLevel: normalizeText(item.requiredLevel)
      };
    })
    .filter(Boolean);
}

function computeSourceReadiness(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const nowMs = Number.isFinite(Number(payload.nowMs)) ? Number(payload.nowMs) : Date.now();
  const intentRiskTier = normalizeRiskTier(payload.intentRiskTier);
  const thresholds = resolveThresholds(intentRiskTier);
  const candidates = normalizeCandidates(payload.candidates);
  const retrieveNeeded = payload.retrieveNeeded === true;
  const retrievalQuality = normalizeText(payload.retrievalQuality);
  const evidenceCoverage = clamp01(payload.evidenceCoverage);
  const reasonCodes = [];

  if (!candidates.length) {
    if (retrieveNeeded && intentRiskTier === 'high' && retrievalQuality === 'bad') {
      reasonCodes.push('source_missing_high_risk');
      return {
        intentRiskTier,
        sourceAuthorityScore: 0,
        sourceFreshnessScore: 0,
        officialOnlyRequired: thresholds.officialOnlyRequired,
        officialOnlySatisfied: false,
        sourceReadinessDecision: 'refuse',
        reasonCodes,
        sampleSize: 0,
        staleSourceCount: 0,
        nonOfficialCount: 0
      };
    }
    if (retrieveNeeded && retrievalQuality === 'bad') reasonCodes.push('source_missing');
    if (retrieveNeeded && retrievalQuality !== 'bad') reasonCodes.push('source_metadata_missing');
    return {
      intentRiskTier,
      sourceAuthorityScore: 0,
      sourceFreshnessScore: 0,
      officialOnlyRequired: thresholds.officialOnlyRequired,
      officialOnlySatisfied: thresholds.officialOnlyRequired !== true,
      sourceReadinessDecision: retrieveNeeded && retrievalQuality === 'bad'
        ? (intentRiskTier === 'high' ? 'refuse' : 'clarify')
        : (intentRiskTier === 'high' && retrieveNeeded ? 'clarify' : 'allow'),
      reasonCodes,
      sampleSize: 0,
      staleSourceCount: 0,
      nonOfficialCount: 0
    };
  }

  const authorityScores = [];
  const freshnessScores = [];
  let staleSourceCount = 0;
  let nonOfficialCount = 0;
  let officialCount = 0;
  let requiredNonOfficialCount = 0;
  let requiredBlockedCount = 0;
  let optionalBlockedCount = 0;

  candidates.forEach((candidate) => {
    const typeScore = sourceTypeScore(candidate.sourceType);
    const levelScore = authorityLevelScore(candidate.authorityLevel);
    const stateScore = statusScore(candidate.status);
    const authorityScore = clamp01((typeScore * 0.6) + (levelScore * 0.4)) * stateScore;
    authorityScores.push(authorityScore);
    if (candidate.sourceType === 'official' || candidate.sourceType === 'semi_official') {
      officialCount += 1;
    } else {
      nonOfficialCount += 1;
      if (candidate.requiredLevel === 'required') requiredNonOfficialCount += 1;
    }
    const itemFreshness = freshnessScore(candidate.validUntilMs, nowMs);
    freshnessScores.push(itemFreshness);
    const blockedByState = candidate.status === 'blocked' || candidate.status === 'dead' || candidate.status === 'retired';
    const staleOrBlocked = itemFreshness <= 0.05 || blockedByState;
    if (staleOrBlocked) {
      staleSourceCount += 1;
      if (candidate.requiredLevel === 'required') requiredBlockedCount += 1;
      else optionalBlockedCount += 1;
    }
  });

  const sourceAuthorityScore = authorityScores.length
    ? clamp01(authorityScores.reduce((sum, score) => sum + score, 0) / authorityScores.length)
    : 0;
  const sourceFreshnessScore = freshnessScores.length
    ? clamp01(freshnessScores.reduce((sum, score) => sum + score, 0) / freshnessScores.length)
    : 0;
  const officialOnlySatisfied = thresholds.officialOnlyRequired === true
    ? (officialCount > 0 && requiredNonOfficialCount === 0)
    : true;

  if (thresholds.officialOnlyRequired && !officialOnlySatisfied) reasonCodes.push('official_only_not_satisfied');
  if (staleSourceCount > 0) reasonCodes.push('stale_source_detected');
  if (requiredBlockedCount > 0) reasonCodes.push('required_source_blocked');
  if (optionalBlockedCount > 0) reasonCodes.push('optional_source_stale');
  if (sourceAuthorityScore < thresholds.minAuthority) reasonCodes.push('authority_below_threshold');
  if (sourceFreshnessScore < thresholds.minFreshness) reasonCodes.push('freshness_below_threshold');
  if (retrievalQuality === 'bad') reasonCodes.push('retrieval_quality_bad');
  if (retrievalQuality === 'mixed') reasonCodes.push('retrieval_quality_mixed');
  if (evidenceCoverage > 0 && evidenceCoverage < 0.5) reasonCodes.push('evidence_coverage_low');

  let sourceReadinessDecision = 'allow';
  if (requiredBlockedCount > 0) sourceReadinessDecision = 'refuse';
  else if (!officialOnlySatisfied && thresholds.officialOnlyRequired) sourceReadinessDecision = 'refuse';
  else if (intentRiskTier === 'high' && (sourceAuthorityScore < thresholds.minAuthority || sourceFreshnessScore < thresholds.minFreshness)) {
    sourceReadinessDecision = 'refuse';
  } else if (sourceAuthorityScore < thresholds.minAuthority || sourceFreshnessScore < thresholds.minFreshness || retrievalQuality === 'bad') {
    sourceReadinessDecision = intentRiskTier === 'low' ? 'hedged' : 'clarify';
  } else if (optionalBlockedCount > 0) {
    sourceReadinessDecision = 'hedged';
  } else if (retrievalQuality === 'mixed' || evidenceCoverage < 0.7) {
    sourceReadinessDecision = 'hedged';
  }

  return {
    intentRiskTier,
    sourceAuthorityScore,
    sourceFreshnessScore,
    officialOnlyRequired: thresholds.officialOnlyRequired,
    officialOnlySatisfied,
    sourceReadinessDecision,
    reasonCodes,
    sampleSize: candidates.length,
    staleSourceCount,
    nonOfficialCount,
    requiredBlockedCount,
    optionalBlockedCount
  };
}

module.exports = {
  computeSourceReadiness,
  normalizeRiskTier
};
