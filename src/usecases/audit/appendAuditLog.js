'use strict';

const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');

async function appendAuditLog(data) {
  return auditLogsRepo.appendAuditLog(data || {});
}

module.exports = {
  appendAuditLog
};
