'use strict';

const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

async function appendLlmAdoptAudit(params, deps) {
  const payload = params || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');
  const decisionLogId = payload.decisionLogId ? String(payload.decisionLogId) : null;
  const adoptedAction = payload.adoptedAction ? String(payload.adoptedAction) : null;
  const repo = deps && deps.auditLogsRepo ? deps.auditLogsRepo : auditLogsRepo;
  const entry = {
    action: 'LLM_SUGGESTION_ADOPTED',
    eventType: 'LLM_SUGGESTION_ADOPTED',
    lineUserId,
    decisionLogId,
    adoptedAction,
    suggestion: payload.suggestion || null,
    safety: payload.safety || null,
    createdAt: payload.createdAt
  };
  return repo.appendAuditLog(entry);
}

module.exports = {
  appendLlmAdoptAudit
};
