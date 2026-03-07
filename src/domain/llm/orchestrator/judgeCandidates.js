'use strict';

const { containsLegacyTemplateTerms } = require('../conversation/paidReplyGuard');

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

function scoreCandidate(packet, candidate, options) {
  const payload = candidate && typeof candidate === 'object' ? candidate : {};
  const strategy = normalizeText(options && options.strategy).toLowerCase();
  const text = normalizeText(payload.replyText);
  const bulletCount = countActionBullets(text);
  const questionCount = countQuestions(text);
  const legacyTemplateHit = containsLegacyTemplateTerms(text);
  const directUrl = hasDirectUrl(text);
  const rejectedReasons = [];

  if (!text) rejectedReasons.push('empty_reply');
  if (legacyTemplateHit) rejectedReasons.push('legacy_template');
  if (directUrl) rejectedReasons.push('direct_url');
  if (bulletCount > 3) rejectedReasons.push('too_many_actions');
  if (questionCount > 1) rejectedReasons.push('too_many_questions');

  const safety = rejectedReasons.length ? 0 : 1;
  const naturalness = Math.max(0, 1 - ((legacyTemplateHit ? 0.5 : 0) + (questionCount > 1 ? 0.2 : 0) + (bulletCount > 3 ? 0.2 : 0)));
  const contextConsistency = hasDomainAlignment(packet, payload) ? 1 : 0.2;
  const taskProgress = bulletCount > 0 && bulletCount <= 3 ? 1 : (strategy === 'clarify' && questionCount === 1 ? 0.8 : 0.3);
  const groundedness = payload.retrievalQuality === 'good'
    ? 1
    : (payload.retrievalQuality === 'mixed' ? 0.6 : (payload.kind === 'clarify_candidate' || payload.kind === 'domain_concierge_candidate' ? 0.7 : 0.2));
  const sensibleness = text.length >= 8 ? 1 : 0.4;
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
      sensibleness,
      contextConsistency,
      taskProgress,
      groundedness,
      naturalness,
      safety
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
    return right.verdict.total - left.verdict.total;
  });
  const selected = scored[0] || null;
  return {
    selected: selected ? selected.candidate : null,
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
