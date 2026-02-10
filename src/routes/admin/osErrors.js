'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

async function handleErrorsSummary(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const serverTime = new Date().toISOString();

  const [warnLinks, retryQueuePending, recentOpsExecAudits, recentNotificationExecAudits] = await Promise.all([
    linkRegistryRepo.listLinks({ state: 'WARN', limit: 20 }),
    sendRetryQueueRepo.listPending(20),
    auditLogsRepo.listAuditLogs({ action: 'ops_decision.execute', limit: 20 }),
    auditLogsRepo.listAuditLogs({ action: 'notifications.send.execute', limit: 20 })
  ]);

  await appendAuditLog({
    actor,
    action: 'admin_os.errors.view',
    entityType: 'admin_os',
    entityId: 'errors',
    traceId,
    requestId,
    payloadSummary: {
      warnLinksCount: Array.isArray(warnLinks) ? warnLinks.length : 0,
      retryQueuePendingCount: Array.isArray(retryQueuePending) ? retryQueuePending.length : 0
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime,
    traceId,
    warnLinks: Array.isArray(warnLinks) ? warnLinks : [],
    retryQueuePending: Array.isArray(retryQueuePending) ? retryQueuePending : [],
    recentOpsDecisionExecAudits: Array.isArray(recentOpsExecAudits) ? recentOpsExecAudits : [],
    recentNotificationSendExecAudits: Array.isArray(recentNotificationExecAudits) ? recentNotificationExecAudits : []
  }));
}

module.exports = {
  handleErrorsSummary
};

