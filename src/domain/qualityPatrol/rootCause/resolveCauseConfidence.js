'use strict';

function resolveCauseConfidence(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const evidenceCount = Array.isArray(payload.supportingEvidence) ? payload.supportingEvidence.length : 0;
  const gapCount = Array.isArray(payload.evidenceGaps) ? payload.evidenceGaps.length : 0;
  const blockerCount = Array.isArray(payload.observationBlockers) ? payload.observationBlockers.length : 0;
  const analysisStatus = typeof payload.analysisStatus === 'string' ? payload.analysisStatus : 'analyzed';

  if (analysisStatus !== 'analyzed') {
    if (evidenceCount >= 2 && blockerCount <= 1) return 'medium';
    return 'low';
  }

  if (evidenceCount >= 3 && gapCount === 0 && blockerCount === 0) return 'high';
  if (evidenceCount >= 2 && gapCount <= 1) return 'medium';
  return 'low';
}

module.exports = {
  resolveCauseConfidence
};
