'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');

async function appendDecisionTrace(entry, deps) {
  const fn = deps && typeof deps.appendAuditLog === 'function' ? deps.appendAuditLog : appendAuditLog;
  const payload = entry && typeof entry === 'object' ? entry : {};
  return fn(Object.assign({}, payload, {
    action: payload.action || 'llm_gate.decision'
  }));
}

module.exports = {
  appendDecisionTrace
};
