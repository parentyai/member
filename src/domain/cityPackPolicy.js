'use strict';

const { SOURCE_BLOCK_REASONS } = require('../usecases/cityPack/validateCityPackSources');

function evaluateCityPackSourcePolicy(validationResult) {
  const result = validationResult && typeof validationResult === 'object' ? validationResult : {};
  const optionalInvalidSourceRefs = Array.isArray(result.optionalInvalidSourceRefs) ? result.optionalInvalidSourceRefs : [];
  const blockingInvalidSourceRefs = Array.isArray(result.blockingInvalidSourceRefs)
    ? result.blockingInvalidSourceRefs
    : (Array.isArray(result.invalidSourceRefs) ? result.invalidSourceRefs : []);
  if (result.ok) {
    return {
      allowed: true,
      blockedReasonCategory: null,
      invalidSourceRefs: [],
      blockingInvalidSourceRefs: [],
      optionalInvalidSourceRefs
    };
  }
  return {
    allowed: false,
    blockedReasonCategory: result.blockedReasonCategory || SOURCE_BLOCK_REASONS.SOURCE_BLOCKED,
    invalidSourceRefs: Array.isArray(result.invalidSourceRefs) ? result.invalidSourceRefs : [],
    blockingInvalidSourceRefs,
    optionalInvalidSourceRefs
  };
}

module.exports = {
  SOURCE_BLOCK_REASONS,
  evaluateCityPackSourcePolicy
};
