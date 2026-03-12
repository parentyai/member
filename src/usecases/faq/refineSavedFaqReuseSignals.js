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
  if (intentRiskTier === 'high' && sourceReadiness.officialOnlySatisfied !== true) {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_missing_official_source_refs')) {
      reasonCodes.push('saved_faq_missing_official_source_refs');
    }
  }
  if (sourceReadiness.sourceReadinessDecision === 'refuse') {
    removeReadyCode();
    if (!reasonCodes.includes('saved_faq_source_readiness_blocked')) {
      reasonCodes.push('saved_faq_source_readiness_blocked');
    }
  }

  return {
    savedFaqReused: true,
    savedFaqReusePass: reasonCodes.length === 0 || (reasonCodes.length === 1 && reasonCodes[0] === 'saved_faq_reuse_ready'),
    savedFaqReuseReasonCodes: normalizeCodes(reasonCodes.length ? reasonCodes : ['saved_faq_reuse_ready']),
    sourceSnapshotRefs: Array.isArray(savedFaqSignals.sourceSnapshotRefs)
      ? savedFaqSignals.sourceSnapshotRefs.slice(0, 8)
      : []
  };
}

module.exports = {
  refineSavedFaqReuseSignals
};
