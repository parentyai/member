'use strict';

const { sanitizeCandidates } = require('../../../domain/llm/injectionGuard');

function sanitizeRetrievalCandidates(inputGroups) {
  const groups = Array.isArray(inputGroups) ? inputGroups : [];
  const sanitizedGroups = groups.map((group) => sanitizeCandidates(Array.isArray(group) ? group : []));
  const blockedReasons = Array.from(new Set(sanitizedGroups
    .flatMap((group) => (Array.isArray(group.blockedReasons) ? group.blockedReasons : []))
    .filter(Boolean)));
  const candidatesByGroup = sanitizedGroups.map((group) => (Array.isArray(group.candidates) ? group.candidates : []));
  const candidates = candidatesByGroup.flat();
  return {
    candidatesByGroup,
    candidates,
    injectionFindings: sanitizedGroups.some((group) => group && group.injectionFindings === true),
    blockedReasons
  };
}

module.exports = {
  sanitizeRetrievalCandidates
};
