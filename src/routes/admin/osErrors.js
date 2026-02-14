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

  const [
    warnLinks,
    retryQueuePending,
    recentOpsExecAudits,
    recentNotificationExecAudits,
    recentSegmentExecAuditsRaw,
    recentRetryExecAuditsRaw,
    recentRouteErrors
  ] = await Promise.all([
    linkRegistryRepo.listLinks({ state: 'WARN', limit: 20 }),
    sendRetryQueueRepo.listPending(20),
    auditLogsRepo.listAuditLogs({ action: 'ops_decision.execute', limit: 20 }),
    auditLogsRepo.listAuditLogs({ action: 'notifications.send.execute', limit: 20 }),
    auditLogsRepo.listAuditLogs({ action: 'segment_send.execute', limit: 40 }),
    auditLogsRepo.listAuditLogs({ action: 'retry_queue.execute', limit: 40 }),
    auditLogsRepo.listAuditLogs({ action: 'route_error', limit: 40 })
  ]);

  const recentSegmentSendExecAudits = (Array.isArray(recentSegmentExecAuditsRaw) ? recentSegmentExecAuditsRaw : [])
    .filter((log) => {
      const summary = log && log.payloadSummary ? log.payloadSummary : null;
      if (!summary) return false;
      if (summary.ok === false) return true;
      if (Number(summary.failures) > 0) return true;
      if (typeof summary.reason === 'string' && summary.reason.length > 0) return true;
      return false;
    })
    .slice(0, 20);

  const recentRetryQueueExecAudits = (Array.isArray(recentRetryExecAuditsRaw) ? recentRetryExecAuditsRaw : [])
    .filter((log) => {
      const summary = log && log.payloadSummary ? log.payloadSummary : null;
      if (!summary) return false;
      if (summary.ok === false) return true;
      if (typeof summary.reason === 'string' && summary.reason.length > 0) return true;
      return false;
    })
    .slice(0, 20);

  await appendAuditLog({
    actor,
      action: 'admin_os.errors.view',
      entityType: 'admin_os',
      entityId: 'errors',
      traceId,
      requestId,
      payloadSummary: {
        warnLinksCount: Array.isArray(warnLinks) ? warnLinks.length : 0,
        retryQueuePendingCount: Array.isArray(retryQueuePending) ? retryQueuePending.length : 0,
        routeErrorsCount: Array.isArray(recentRouteErrors) ? recentRouteErrors.length : 0
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
    recentNotificationSendExecAudits: Array.isArray(recentNotificationExecAudits) ? recentNotificationExecAudits : [],
    recentSegmentSendExecAudits,
    recentRetryQueueExecAudits,
    recentRouteErrors: Array.isArray(recentRouteErrors) ? recentRouteErrors : []
  }));
}

module.exports = {
  handleErrorsSummary
};
