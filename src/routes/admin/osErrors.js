'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.os_errors_summary';

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleErrorsSummary(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const serverTime = new Date().toISOString();

  try {
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

    writeJson(res, 200, {
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
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError(ROUTE_KEY, err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleErrorsSummary
};
