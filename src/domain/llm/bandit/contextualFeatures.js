'use strict';

const CONTEXTUAL_FEATURE_VERSION = 'bandit_ctx_v1';

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function clamp01(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num <= 0) return 0;
  if (num >= 1) return 1;
  return Number(num.toFixed(6));
}

function resolveConfidenceBucket(value) {
  const score = clamp01(value, 0);
  if (score < 0.4) return 'low';
  if (score < 0.75) return 'medium';
  return 'high';
}

function resolveTaskLoadBucket(taskCount) {
  const count = Number(taskCount);
  if (!Number.isFinite(count) || count <= 0) return 'none';
  if (count <= 2) return 'light';
  if (count <= 4) return 'medium';
  return 'heavy';
}

function buildContextualFeatures(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const contextSnapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : {};
  const topTasks = Array.isArray(contextSnapshot.topTasks) ? contextSnapshot.topTasks : [];
  const chosenAction = payload.chosenAction && typeof payload.chosenAction === 'object'
    ? payload.chosenAction
    : {};

  const intentConfidence = clamp01(payload.intentConfidence, 0);
  const contextConfidence = clamp01(payload.contextConfidence, 0);

  return {
    featureVersion: CONTEXTUAL_FEATURE_VERSION,
    journeyPhase: normalizeText(payload.journeyPhase || contextSnapshot.phase, 'pre'),
    tier: normalizeText(payload.userTier, 'free'),
    mode: normalizeText(payload.mode, 'A').toUpperCase(),
    topic: normalizeText(payload.topic, 'general').toLowerCase(),
    riskBucket: normalizeText(payload.riskBucket, 'low').toLowerCase(),
    evidenceNeed: normalizeText(payload.evidenceNeed, 'none').toLowerCase(),
    styleId: normalizeText(chosenAction.styleId, null),
    ctaCount: Number.isFinite(Number(chosenAction.ctaCount)) ? Math.max(0, Math.floor(Number(chosenAction.ctaCount))) : 0,
    lengthBucket: normalizeText(chosenAction.lengthBucket, 'short'),
    timingBucket: normalizeText(chosenAction.timingBucket, 'daytime'),
    questionFlag: chosenAction.questionFlag === true,
    intentConfidence,
    contextConfidence,
    intentConfidenceBucket: resolveConfidenceBucket(intentConfidence),
    contextConfidenceBucket: resolveConfidenceBucket(contextConfidence),
    taskLoadBucket: resolveTaskLoadBucket(topTasks.length),
    topTaskCount: topTasks.length,
    blockedTaskPresent: contextSnapshot.blockedTask && typeof contextSnapshot.blockedTask === 'object',
    dueSoonTaskPresent: contextSnapshot.dueSoonTask && typeof contextSnapshot.dueSoonTask === 'object'
  };
}

module.exports = {
  CONTEXTUAL_FEATURE_VERSION,
  resolveConfidenceBucket,
  resolveTaskLoadBucket,
  buildContextualFeatures
};
