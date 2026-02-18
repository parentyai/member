'use strict';

const { SOURCE_BLOCK_REASONS } = require('../usecases/cityPack/validateCityPackSources');

function evaluateCityPackSourcePolicy(validationResult) {
  const result = validationResult && typeof validationResult === 'object' ? validationResult : {};
  if (result.ok) {
    return {
      allowed: true,
      blockedReasonCategory: null,
      invalidSourceRefs: []
    };
  }
  return {
    allowed: false,
    blockedReasonCategory: result.blockedReasonCategory || SOURCE_BLOCK_REASONS.SOURCE_BLOCKED,
    invalidSourceRefs: Array.isArray(result.invalidSourceRefs) ? result.invalidSourceRefs : []
  };
}

module.exports = {
  SOURCE_BLOCK_REASONS,
  evaluateCityPackSourcePolicy
};
