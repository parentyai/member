'use strict';

function evaluateCloseDecision({ readiness, consistency }) {
  if (consistency && consistency.status === 'FAIL') {
    return {
      phaseResult: 'CONSISTENCY_FAIL',
      closeDecision: 'NO_CLOSE',
      closeReason: 'consistency_fail'
    };
  }
  if (readiness && readiness.status === 'READY') {
    return {
      phaseResult: 'READY',
      closeDecision: 'CLOSE',
      closeReason: 'readiness_ready'
    };
  }
  if (readiness && readiness.status === 'NOT_READY') {
    return {
      phaseResult: 'NOT_READY',
      closeDecision: 'NO_CLOSE',
      closeReason: 'readiness_not_ready'
    };
  }
  return {
    phaseResult: 'UNKNOWN',
    closeDecision: 'NO_CLOSE',
    closeReason: 'unknown'
  };
}

module.exports = {
  evaluateCloseDecision
};
