'use strict';

const TOP_LEVEL_KEYS = new Set([
  'traceId',
  'requestId',
  'lineUserId',
  'questionHash',
  'question',
  'locale',
  'matchedArticleIds',
  'blockedReason',
  'decision',
  'ok',
  'blocked',
  'error',
  'llmStatus',
  'model',
  'policySnapshotVersion',
  'policySource',
  'policyContext',
  'sanitizeApplied',
  'sanitizedCandidateCount',
  'sanitizeBlockedReasons',
  'injectionFindings',
  'intentRiskTier',
  'riskReasonCodes',
  'legalDecision',
  'legalReasonCodes',
  'sourceReadinessDecision',
  'sourceReadinessReasons',
  'readinessDecision',
  'readinessReasonCodes',
  'answerReadinessVersion',
  'readinessDecisionV2',
  'readinessReasonCodesV2',
  'readinessSafeResponseModeV2',
  'emergencyContextActive',
  'emergencyOfficialSourceSatisfied',
  'journeyPhase',
  'taskBlockerDetected',
  'journeyAlignedAction',
  'cityPackGrounded',
  'cityPackFreshnessScore',
  'cityPackAuthorityScore',
  'savedFaqReused',
  'savedFaqReusePass',
  'savedFaqReuseReasonCodes',
  'savedFaqValid',
  'savedFaqAllowedIntent',
  'savedFaqAuthorityScore',
  'crossSystemConflictDetected',
  'sourceSnapshotRefs',
  'createdAt'
]);

const BLOCKED_KEYS = new Set([
  'fullReplyText',
  'rawPrompt',
  'rawKbBodies',
  'fullRequestBody'
]);

function sanitizeFaqAuditPayload(entry) {
  const source = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
  const sanitized = {};
  const dropped = [];

  Object.keys(source).forEach((key) => {
    if (!TOP_LEVEL_KEYS.has(key) || BLOCKED_KEYS.has(key)) {
      dropped.push(key);
      return;
    }
    sanitized[key] = source[key];
  });

  if (dropped.length > 0) {
    sanitized._droppedKeyCount = dropped.length;
    sanitized._droppedKeysSample = Array.from(new Set(dropped)).slice(0, 3);
  }

  return sanitized;
}

module.exports = {
  sanitizeFaqAuditPayload
};
