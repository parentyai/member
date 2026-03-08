'use strict';

function evaluateReleaseGate(metrics) {
  const payload = metrics && typeof metrics === 'object' ? metrics : {};
  const contradictions = Number(payload.contradictionRate || 0);
  const legacyTemplateHit = Number(payload.legacyTemplateHitRate || 0);
  const retrievalMisfire = Number(payload.greetingRetrievalFallback || 0);
  const directUrlRate = Number(payload.directUrlRate || 0);
  const blockers = [];
  if (legacyTemplateHit > 0.005) blockers.push('legacy_template_hit_rate_exceeded');
  if (contradictions > 0.02) blockers.push('contradiction_rate_exceeded');
  if (retrievalMisfire > 0) blockers.push('greeting_retrieval_fallback_detected');
  if (directUrlRate > 0) blockers.push('direct_url_rate_exceeded');
  return {
    pass: blockers.length === 0,
    blockers
  };
}

module.exports = {
  evaluateReleaseGate
};
