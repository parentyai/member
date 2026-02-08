'use strict';

const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

async function appendLlmSuggestionAudit(params, deps) {
  const payload = params || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');
  const repo = deps && deps.auditLogsRepo ? deps.auditLogsRepo : auditLogsRepo;
  const entry = {
    action: 'LLM_SUGGESTION',
    eventType: 'LLM_SUGGESTION',
    lineUserId,
    inputHash: payload.inputHash || null,
    suggestion: payload.suggestion || null,
    safety: payload.safety || null,
    evidenceSnapshot: payload.evidenceSnapshot || null,
    createdAt: payload.createdAt
  };
  return repo.appendAuditLog(entry);
}

module.exports = {
  appendLlmSuggestionAudit
};
