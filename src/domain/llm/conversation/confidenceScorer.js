'use strict';

const INTENT_CONFIDENCE_THRESHOLD = 0.6;
const CONTEXT_CONFIDENCE_THRESHOLD = 0.55;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num <= 0) return 0;
  if (num >= 1) return 1;
  return Math.round(num * 10000) / 10000;
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function computeIntentConfidence(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const question = normalizeText(payload.question);
  const topic = normalizeText(payload.topic).toLowerCase() || 'general';
  const mode = normalizeText(payload.mode).toUpperCase() || 'A';
  const blockedReasons = Array.isArray(payload.blockedReasons) ? payload.blockedReasons.filter(Boolean) : [];

  let score = 0.55;
  if (question.length >= 12) score += 0.08;
  if (question.length >= 24) score += 0.07;
  if (question.length <= 4) score -= 0.12;

  if (mode === 'B' && hasAny(question, [/(visa|ビザ|税|tax|医療|medical|学校|school|規制|法令|期限)/i])) {
    score += 0.14;
  }
  if (mode === 'C' && hasAny(question, [/(週末|観光|旅行|trip|activity|イベント)/i])) {
    score += 0.14;
  }
  if (topic === 'general' && hasAny(question, [/(どう|なに|help|助けて)/i])) {
    score -= 0.08;
  }
  if (blockedReasons.length > 0) score -= 0.1;

  return clamp01(score);
}

function computeContextConfidence(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const contextSnapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : null;

  if (!contextSnapshot) return 0.35;

  let score = 0.45;
  if (normalizeText(contextSnapshot.phase)) score += 0.1;

  const topTasks = Array.isArray(contextSnapshot.topTasks) ? contextSnapshot.topTasks : [];
  const blockedTask = contextSnapshot.blockedTask && typeof contextSnapshot.blockedTask === 'object'
    ? contextSnapshot.blockedTask
    : null;
  const dueSoonTask = contextSnapshot.dueSoonTask && typeof contextSnapshot.dueSoonTask === 'object'
    ? contextSnapshot.dueSoonTask
    : null;

  if (topTasks.length > 0) score += 0.12;
  if (blockedTask) score += 0.08;
  if (dueSoonTask) score += 0.07;

  const updatedAt = normalizeText(contextSnapshot.updatedAt);
  if (updatedAt) {
    const ms = Date.parse(updatedAt);
    if (Number.isFinite(ms)) {
      const ageHours = Math.max(0, (Date.now() - ms) / (60 * 60 * 1000));
      if (ageHours <= 24 * 3) score += 0.1;
      else if (ageHours <= 24 * 14) score += 0.05;
      else score -= 0.08;
    }
  }

  return clamp01(score);
}

function resolveRiskBucket(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const mode = normalizeText(payload.mode).toUpperCase();
  const blockedReasons = Array.isArray(payload.blockedReasons) ? payload.blockedReasons.filter(Boolean) : [];
  const contextSnapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : null;

  if (mode === 'B') return 'high';
  if (blockedReasons.length > 0) return 'high';

  const topTasks = Array.isArray(contextSnapshot && contextSnapshot.topTasks) ? contextSnapshot.topTasks : [];
  if (topTasks.some((item) => item && item.status === 'locked')) return 'high';
  if (topTasks.length >= 2) return 'medium';
  return 'low';
}

function shouldForceClarify(intentConfidence, contextConfidence, thresholds) {
  const policy = thresholds && typeof thresholds === 'object' ? thresholds : {};
  const intentThreshold = Number.isFinite(Number(policy.intentConfidence))
    ? Number(policy.intentConfidence)
    : INTENT_CONFIDENCE_THRESHOLD;
  const contextThreshold = Number.isFinite(Number(policy.contextConfidence))
    ? Number(policy.contextConfidence)
    : CONTEXT_CONFIDENCE_THRESHOLD;
  return Number(intentConfidence) < intentThreshold || Number(contextConfidence) < contextThreshold;
}

function scoreConversationConfidence(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const intentConfidence = computeIntentConfidence(payload);
  const contextConfidence = computeContextConfidence(payload);
  const riskBucket = resolveRiskBucket(payload);
  return {
    intentConfidence,
    contextConfidence,
    riskBucket,
    forceClarify: shouldForceClarify(intentConfidence, contextConfidence, payload.thresholds || null),
    thresholds: {
      intentConfidence: INTENT_CONFIDENCE_THRESHOLD,
      contextConfidence: CONTEXT_CONFIDENCE_THRESHOLD
    }
  };
}

module.exports = {
  INTENT_CONFIDENCE_THRESHOLD,
  CONTEXT_CONFIDENCE_THRESHOLD,
  clamp01,
  computeIntentConfidence,
  computeContextConfidence,
  resolveRiskBucket,
  shouldForceClarify,
  scoreConversationConfidence
};
