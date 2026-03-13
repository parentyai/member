'use strict';

function normalizeCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((item) => {
    if (typeof item !== 'string') return;
    const normalized = item.trim();
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 8);
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
}

const HIGH_RISK_MIN_AUTHORITY = 0.72;
const HIGH_RISK_MIN_FRESHNESS = 0.72;
const MEDIUM_RISK_MIN_AUTHORITY = 0.62;
const MEDIUM_RISK_MIN_FRESHNESS = 0.64;

function refineSavedFaqReuseSignals(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const savedFaqSignals = payload.savedFaqSignals && typeof payload.savedFaqSignals === 'object'
    ? payload.savedFaqSignals
    : {
      savedFaqReused: false,
      savedFaqReusePass: false,
      savedFaqReuseReasonCodes: ['no_saved_faq_candidate'],
      sourceSnapshotRefs: []
    };
  const sourceReadiness = payload.sourceReadiness && typeof payload.sourceReadiness === 'object'
    ? payload.sourceReadiness
    : {};
  const intentRiskTier = typeof payload.intentRiskTier === 'string' ? payload.intentRiskTier.trim().toLowerCase() : 'low';
  if (savedFaqSignals.savedFaqReused !== true) return savedFaqSignals;

  const reasonCodes = normalizeCodes(savedFaqSignals.savedFaqReuseReasonCodes);
  const removeReadyCode = () => {
    const index = reasonCodes.indexOf('saved_faq_reuse_ready');
    if (index >= 0) reasonCodes.splice(index, 1);
  };
  const sourceSnapshotRefs = Array.isArray(savedFaqSignals.sourceSnapshotRefs)
    ? savedFaqSignals.sourceSnapshotRefs.slice(0, 8)
    : [];
  const authorityScore = clamp01(sourceReadiness.sourceAuthorityScore);
  const freshnessScore = clamp01(sourceReadiness.sourceFreshnessScore);

  if (intentRiskTier === 'high' && sourceReadiness.officialOnlySatisfied !== true) {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_missing_official_source_refs')) {
      reasonCodes.push('saved_faq_missing_official_source_refs');
    }
  }
  if (intentRiskTier === 'high' && sourceReadiness.sourceReadinessDecision !== 'allow') {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_source_readiness_blocked')) {
      reasonCodes.push('saved_faq_source_readiness_blocked');
    }
  } else if (intentRiskTier === 'medium' && sourceReadiness.sourceReadinessDecision !== 'allow') {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_source_readiness_blocked')) {
      reasonCodes.push('saved_faq_source_readiness_blocked');
    }
  } else if (sourceReadiness.sourceReadinessDecision === 'refuse') {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_source_readiness_blocked')) {
      reasonCodes.push('saved_faq_source_readiness_blocked');
    }
  }
  if (intentRiskTier === 'medium' && sourceSnapshotRefs.length === 0) {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_source_snapshot_missing')) {
      reasonCodes.push('saved_faq_source_snapshot_missing');
    }
  }
  if (intentRiskTier === 'high' && sourceSnapshotRefs.length === 0) {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_source_snapshot_missing')) {
      reasonCodes.push('saved_faq_source_snapshot_missing');
    }
  }
  if (intentRiskTier === 'high' && (authorityScore === null || authorityScore < HIGH_RISK_MIN_AUTHORITY)) {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_authority_below_threshold')) {
      reasonCodes.push('saved_faq_authority_below_threshold');
    }
  }
  if (intentRiskTier === 'high' && (freshnessScore === null || freshnessScore < HIGH_RISK_MIN_FRESHNESS)) {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_freshness_below_threshold')) {
      reasonCodes.push('saved_faq_freshness_below_threshold');
    }
  }
  if (intentRiskTier === 'medium' && (authorityScore === null || authorityScore < MEDIUM_RISK_MIN_AUTHORITY)) {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_authority_below_threshold')) {
      reasonCodes.push('saved_faq_authority_below_threshold');
    }
  }
  if (intentRiskTier === 'medium' && (freshnessScore === null || freshnessScore < MEDIUM_RISK_MIN_FRESHNESS)) {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_freshness_below_threshold')) {
      reasonCodes.push('saved_faq_freshness_below_threshold');
    }
  }

  return {
    savedFaqReused: true,
    savedFaqReusePass: reasonCodes.length === 0 || (reasonCodes.length === 1 && reasonCodes[0] === 'saved_faq_reuse_ready'),
    savedFaqReuseReasonCodes: normalizeCodes(reasonCodes.length ? reasonCodes : ['saved_faq_reuse_ready']),
    sourceSnapshotRefs
  };
}

module.exports = {
  refineSavedFaqReuseSignals
};
