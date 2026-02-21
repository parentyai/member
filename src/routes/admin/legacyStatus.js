'use strict';

const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');

const LEGACY_ITEMS = Object.freeze([
  { path: '/admin/ops', mode: 'redirect', target: '/admin/app', status: 'primary' },
  { path: '/admin/composer', mode: 'redirect', target: '/admin/app?pane=composer', status: 'legacy_redirect' },
  { path: '/admin/monitor', mode: 'redirect', target: '/admin/app?pane=monitor', status: 'legacy_redirect' },
  { path: '/admin/errors', mode: 'redirect', target: '/admin/app?pane=errors', status: 'legacy_redirect' },
  { path: '/admin/read-model', mode: 'redirect', target: '/admin/app?pane=read-model', status: 'legacy_redirect' },
  { path: '/admin/review', mode: 'legacy_html', target: '/admin/app?pane=audit', status: 'legacy_html' },
  { path: '/admin/master', mode: 'legacy_html', target: '/admin/app?pane=settings', status: 'legacy_html' }
]);

async function handleLegacyStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  const summary = {
    total: LEGACY_ITEMS.length,
    legacyHtmlCount: LEGACY_ITEMS.filter((item) => item.status === 'legacy_html').length,
    redirectCount: LEGACY_ITEMS.filter((item) => item.mode === 'redirect').length
  };

  try {
    try {
      await appendAuditLog({
        actor,
        action: 'legacy_status.view',
        entityType: 'admin_route',
        entityId: 'legacy_status',
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        payloadSummary: summary
      });
    } catch (auditErr) {
      logRouteError('admin.legacy_status.audit', auditErr, { actor, traceId, requestId });
    }

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      generatedAt: new Date().toISOString(),
      summary,
      items: LEGACY_ITEMS
    }));
  } catch (err) {
    logRouteError('admin.legacy_status.view', err, { actor, traceId, requestId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleLegacyStatus
};
