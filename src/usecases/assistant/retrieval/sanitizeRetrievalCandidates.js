'use strict';

const { sanitizeCandidates } = require('../../../domain/llm/injectionGuard');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function prepareCandidateForSanitize(row) {
  const candidate = row && typeof row === 'object' ? Object.assign({}, row) : null;
  if (!candidate) return null;
  const hasBody = normalizeText(candidate.body).length > 0;
  if (!normalizeText(candidate.snippet) && hasBody) {
    candidate.snippet = normalizeText(candidate.body);
    candidate.__snippetFromBody = true;
  }
  return candidate;
}

function restoreCandidateAfterSanitize(row) {
  const candidate = row && typeof row === 'object' ? Object.assign({}, row) : null;
  if (!candidate) return null;
  if (candidate.__snippetFromBody === true) {
    candidate.body = normalizeText(candidate.snippet);
  }
  delete candidate.__snippetFromBody;
  return candidate;
}

function sanitizeRetrievalCandidates(inputGroups) {
  const groups = Array.isArray(inputGroups) ? inputGroups : [];
  const sanitizedGroups = groups.map((group) => {
    const prepared = (Array.isArray(group) ? group : [])
      .map((row) => prepareCandidateForSanitize(row))
      .filter(Boolean);
    const sanitized = sanitizeCandidates(prepared);
    const restoredCandidates = (Array.isArray(sanitized.candidates) ? sanitized.candidates : [])
      .map((row) => restoreCandidateAfterSanitize(row))
      .filter(Boolean);
    return Object.assign({}, sanitized, {
      candidates: restoredCandidates
    });
  });
  const blockedReasons = Array.from(new Set(sanitizedGroups
    .flatMap((group) => (Array.isArray(group.blockedReasons) ? group.blockedReasons : []))
    .filter(Boolean)));
  const candidatesByGroup = sanitizedGroups.map((group) => (Array.isArray(group.candidates) ? group.candidates : []));
  const candidates = candidatesByGroup.flat();
  return {
    candidatesByGroup,
    candidates,
    injectionFindings: sanitizedGroups.some((group) => group && group.injectionFindings === true),
    blockedReasons,
    sanitizeApplied: true,
    sanitizedCandidateCount: candidates.length
  };
}

module.exports = {
  sanitizeRetrievalCandidates
};
