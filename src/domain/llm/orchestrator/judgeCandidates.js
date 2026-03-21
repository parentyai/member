'use strict';

const { containsLegacyTemplateTerms } = require('../conversation/paidReplyGuard');
const { resolveCandidatePriority, isDirectAnswerEligibleCandidate } = require('./candidatePriority');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function countActionBullets(value) {
  const text = normalizeText(value);
  if (!text) return 0;
  return text.split('\n').filter((line) => line.trim().startsWith('・')).length;
}

function countQuestions(value) {
  const text = normalizeText(value);
  if (!text) return 0;
  const matches = text.match(/[?？]/g);
  return Array.isArray(matches) ? matches.length : 0;
}

function hasDirectUrl(value) {
  return /https?:\/\//i.test(normalizeText(value));
}

function hasDomainAlignment(packet, candidate) {
  const packetIntent = normalizeText(packet && packet.normalizedConversationIntent).toLowerCase();
  const candidateIntent = normalizeText(candidate && candidate.domainIntent).toLowerCase();
  if (!packetIntent || packetIntent === 'general') return true;
  return packetIntent === candidateIntent;
}

function resolveStrategyAlignmentPriority(strategy, candidateKind) {
  const normalizedStrategy = normalizeText(strategy).toLowerCase();
  const normalizedKind = normalizeText(candidateKind).toLowerCase();
  if (normalizedStrategy === 'casual') {
    if (normalizedKind === 'casual_candidate' || normalizedKind === 'conversation_candidate') return 40;
    if (normalizedKind === 'clarify_candidate') return 6;
    return 0;
  }
  if (normalizedStrategy === 'clarify') {
    if (normalizedKind === 'clarify_candidate') return 38;
    if (normalizedKind === 'structured_answer_candidate' || normalizedKind === 'grounded_candidate') return 22;
    return 0;
  }
  if (normalizedStrategy === 'grounded_answer') {
    if (normalizedKind === 'continuation_candidate') return 34;
    if (normalizedKind === 'city_pack_backed_candidate' || normalizedKind === 'city_grounded_candidate') return 32;
    if (normalizedKind === 'grounded_candidate' || normalizedKind === 'structured_answer_candidate') return 28;
    return 0;
  }
  if (normalizedStrategy === 'recommendation') {
    if (normalizedKind === 'grounded_candidate' || normalizedKind === 'structured_answer_candidate') return 22;
    return 0;
  }
  return 0;
}

function scoreCandidate(packet, candidate, options) {
  const payload = candidate && typeof candidate === 'object' ? candidate : {};
  const strategy = normalizeText(options && options.strategy).toLowerCase();
  const followupIntent = normalizeText(packet && packet.followupIntent).toLowerCase();
  const followupAware = followupIntent === 'docs_required' || followupIntent === 'appointment_needed' || followupIntent === 'next_step';
  const contextResume = packet && packet.contextResume === true;
  const directAnswerCandidate = isDirectAnswerEligibleCandidate(packet, payload);
  const text = normalizeText(payload.replyText);
  const bulletCount = countActionBullets(text);
  const questionCount = countQuestions(text);
  const legacyTemplateHit = containsLegacyTemplateTerms(text);
  const directUrl = hasDirectUrl(text);
  const candidatePriority = resolveCandidatePriority(packet, payload);
  const strategyAlignmentPriority = resolveStrategyAlignmentPriority(strategy, payload.kind);
  const rejectedReasons = [];

  if (!text) rejectedReasons.push('empty_reply');
  if (legacyTemplateHit) rejectedReasons.push('legacy_template');
  if (directUrl) rejectedReasons.push('direct_url');
  if (bulletCount > 3) rejectedReasons.push('too_many_actions');
  if (questionCount > 1) rejectedReasons.push('too_many_questions');

  const safety = rejectedReasons.length ? 0 : 1;
  let naturalness = Math.max(0, 1 - ((legacyTemplateHit ? 0.5 : 0) + (questionCount > 1 ? 0.2 : 0) + (bulletCount > 3 ? 0.2 : 0)));
  if (followupAware && payload.kind === 'clarify_candidate' && directAnswerCandidate !== true) {
    naturalness = Math.max(0, naturalness - 0.08);
  }
  const contextConsistency = hasDomainAlignment(packet, payload) ? 1 : 0.2;
  let taskProgress = bulletCount > 0 && bulletCount <= 3 ? 1 : (strategy === 'clarify' && questionCount === 1 ? 0.8 : 0.3);
  if (strategy === 'casual' && payload.kind === 'casual_candidate') {
    taskProgress = Math.min(1, taskProgress + 0.55);
  }
  if (strategy === 'clarify' && payload.kind === 'clarify_candidate') {
    taskProgress = Math.min(1, taskProgress + 0.2);
  }
  if (followupAware && directAnswerCandidate) {
    taskProgress = Math.min(1, taskProgress + 0.35);
  }
  if (contextResume && hasDomainAlignment(packet, payload)) {
    taskProgress = Math.min(1, taskProgress + 0.1);
  }
  const groundedness = payload.retrievalQuality === 'good'
    ? 1
    : (payload.retrievalQuality === 'mixed' ? 0.6 : (payload.kind === 'clarify_candidate' || payload.kind === 'domain_concierge_candidate' ? 0.7 : 0.2));
  let sensibleness = text.length >= 8 ? 1 : 0.4;
  if (followupAware && directAnswerCandidate && text.length >= 8) {
    sensibleness = 1;
  }
  const directAnswerFit = followupAware ? (directAnswerCandidate ? 1 : 0.35) : 0.5;
  const total = Number(((sensibleness * 0.18)
    + (contextConsistency * 0.18)
    + (taskProgress * 0.2)
    + (groundedness * 0.18)
    + (naturalness * 0.16)
    + (safety * 0.1)).toFixed(4));

  return {
    candidateId: payload.id || payload.kind || 'candidate',
    total,
    rejectedReasons,
    metrics: {
      candidatePriority,
      strategyAlignmentPriority,
      sensibleness,
      contextConsistency,
      taskProgress,
      groundedness,
      naturalness,
      safety,
      directAnswerFit
    }
  };
}

function judgeCandidates(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const packet = payload.packet && typeof payload.packet === 'object' ? payload.packet : {};
  const strategy = normalizeText(payload.strategy || '');
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const scored = candidates.map((candidate) => ({
    candidate,
    verdict: scoreCandidate(packet, candidate, { strategy })
  }));
  scored.sort((left, right) => {
    const leftRejected = left.verdict.rejectedReasons.length > 0 ? 1 : 0;
    const rightRejected = right.verdict.rejectedReasons.length > 0 ? 1 : 0;
    if (leftRejected !== rightRejected) return leftRejected - rightRejected;
    const leftPriority = (Number(left.verdict.metrics && left.verdict.metrics.candidatePriority) || 0)
      + (Number(left.verdict.metrics && left.verdict.metrics.strategyAlignmentPriority) || 0);
    const rightPriority = (Number(right.verdict.metrics && right.verdict.metrics.candidatePriority) || 0)
      + (Number(right.verdict.metrics && right.verdict.metrics.strategyAlignmentPriority) || 0);
    if (rightPriority !== leftPriority) return rightPriority - leftPriority;
    const leftDirect = Number(left.verdict.metrics && left.verdict.metrics.directAnswerFit) || 0;
    const rightDirect = Number(right.verdict.metrics && right.verdict.metrics.directAnswerFit) || 0;
    if (rightDirect !== leftDirect) return rightDirect - leftDirect;
    return right.verdict.total - left.verdict.total;
  });
  const selected = scored[0] || null;
  return {
    selected: selected ? selected.candidate : null,
    rankedCandidates: scored.map((entry) => entry.candidate),
    judgeWinner: selected ? selected.verdict.candidateId : null,
    judgeScores: scored.map((entry) => ({
      candidateId: entry.verdict.candidateId,
      total: entry.verdict.total,
      rejectedReasons: entry.verdict.rejectedReasons,
      metrics: entry.verdict.metrics
    }))
  };
}

module.exports = {
  judgeCandidates
};
