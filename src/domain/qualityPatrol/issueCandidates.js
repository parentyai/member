'use strict';

const { SIGNAL_STATUS } = require('./constants');

function createIssueCandidate(code, payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  return {
    code,
    slice: data.slice || 'other',
    status: data.status || SIGNAL_STATUS.WARN,
    confidence: Number.isFinite(Number(data.confidence)) ? Math.max(0, Math.min(1, Number(data.confidence))) : 0.5,
    reasons: Array.isArray(data.reasons) ? data.reasons.filter(Boolean) : [],
    supportingSignalCodes: Array.isArray(data.supportingSignalCodes) ? data.supportingSignalCodes.filter(Boolean) : [],
    source: 'conversation_quality_evaluator'
  };
}

module.exports = {
  createIssueCandidate
};
