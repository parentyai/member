'use strict';

const KNOWLEDGE_LIFECYCLE_STATES = Object.freeze([
  'candidate',
  'approved',
  'rejected',
  'deprecated'
]);

const KNOWLEDGE_LIFECYCLE_BUCKETS = Object.freeze([
  'approved_knowledge',
  'candidate_knowledge'
]);

const LIFECYCLE_BUCKETS = Object.freeze({
  approved: 'approved_knowledge',
  candidate: 'candidate_knowledge',
  rejected: 'candidate_knowledge',
  deprecated: 'candidate_knowledge'
});

const STATUS_STATE_FALLBACK = Object.freeze({
  active: 'approved',
  approved: 'approved',
  needs_review: 'candidate',
  draft: 'candidate',
  collecting: 'candidate',
  queued: 'candidate',
  blocked: 'rejected',
  rejected: 'rejected',
  disabled: 'deprecated',
  dead: 'deprecated',
  retired: 'deprecated',
  deleted: 'deprecated'
});

const ALLOWED_TRANSITIONS = Object.freeze({
  candidate: new Set(['candidate', 'approved', 'rejected', 'deprecated']),
  approved: new Set(['approved', 'candidate', 'rejected', 'deprecated']),
  rejected: new Set(['rejected', 'candidate', 'approved', 'deprecated']),
  deprecated: new Set(['deprecated', 'candidate', 'approved'])
});

function normalizeString(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  return normalized;
}

function normalizeKnowledgeLifecycleState(value, fallback) {
  const normalized = normalizeString(value);
  if (normalized && KNOWLEDGE_LIFECYCLE_STATES.includes(normalized)) return normalized;
  const normalizedFallback = normalizeString(fallback);
  if (normalizedFallback && KNOWLEDGE_LIFECYCLE_STATES.includes(normalizedFallback)) return normalizedFallback;
  return 'candidate';
}

function isKnowledgeLifecycleState(value) {
  const normalized = normalizeString(value);
  return Boolean(normalized && KNOWLEDGE_LIFECYCLE_STATES.includes(normalized));
}

function normalizeKnowledgeLifecycleBucket(value, fallback) {
  const normalized = normalizeString(value);
  if (normalized && KNOWLEDGE_LIFECYCLE_BUCKETS.includes(normalized)) return normalized;
  const normalizedFallback = normalizeString(fallback);
  if (normalizedFallback && KNOWLEDGE_LIFECYCLE_BUCKETS.includes(normalizedFallback)) return normalizedFallback;
  return 'candidate_knowledge';
}

function deriveKnowledgeLifecycleState(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const explicitRaw = normalizeString(payload.knowledgeLifecycleState);
  if (explicitRaw && KNOWLEDGE_LIFECYCLE_STATES.includes(explicitRaw)) return explicitRaw;
  const status = normalizeString(payload.status);
  if (status && Object.prototype.hasOwnProperty.call(STATUS_STATE_FALLBACK, status)) {
    return STATUS_STATE_FALLBACK[status];
  }
  return normalizeKnowledgeLifecycleState(payload.fallbackState, 'candidate');
}

function resolveKnowledgeLifecycleBucket(state) {
  const normalized = normalizeKnowledgeLifecycleState(state, 'candidate');
  return LIFECYCLE_BUCKETS[normalized] || 'candidate_knowledge';
}

function assertKnowledgeLifecycleTransition(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const fromState = normalizeKnowledgeLifecycleState(payload.fromState, 'candidate');
  const toState = normalizeKnowledgeLifecycleState(payload.toState, fromState);
  const allowed = ALLOWED_TRANSITIONS[fromState];
  if (!allowed || !allowed.has(toState)) {
    const err = new Error(`knowledge lifecycle transition blocked: ${fromState} -> ${toState}`);
    err.code = 'KNOWLEDGE_LIFECYCLE_TRANSITION_BLOCKED';
    err.fromState = fromState;
    err.toState = toState;
    throw err;
  }
  return { fromState, toState, allowed: true };
}

module.exports = {
  KNOWLEDGE_LIFECYCLE_STATES,
  KNOWLEDGE_LIFECYCLE_BUCKETS,
  isKnowledgeLifecycleState,
  deriveKnowledgeLifecycleState,
  resolveKnowledgeLifecycleBucket,
  assertKnowledgeLifecycleTransition,
  normalizeKnowledgeLifecycleState,
  normalizeKnowledgeLifecycleBucket
};
