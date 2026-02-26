'use strict';

const { appendAuditLog } = require('../audit/appendAuditLog');

async function appendEmergencyAudit(entry, deps) {
  const payload = entry && typeof entry === 'object' ? entry : {};
  const audit = deps && typeof deps.appendAuditLog === 'function' ? deps.appendAuditLog : appendAuditLog;
  const actor = typeof payload.actor === 'string' && payload.actor.trim() ? payload.actor.trim() : 'emergency_layer';
  const action = typeof payload.action === 'string' && payload.action.trim() ? payload.action.trim() : 'emergency.unknown';
  const entityType = typeof payload.entityType === 'string' && payload.entityType.trim() ? payload.entityType.trim() : 'emergency';
  const entityId = typeof payload.entityId === 'string' && payload.entityId.trim() ? payload.entityId.trim() : 'unknown';
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim() ? payload.requestId.trim() : null;
  const runId = typeof payload.runId === 'string' && payload.runId.trim() ? payload.runId.trim() : null;
  const payloadSummary = payload.payloadSummary && typeof payload.payloadSummary === 'object'
    ? Object.assign({}, payload.payloadSummary, { runId, traceId })
    : { runId, traceId };

  return audit({
    actor,
    action,
    entityType,
    entityId,
    traceId,
    requestId,
    payloadSummary
  });
}

module.exports = {
  appendEmergencyAudit
};
