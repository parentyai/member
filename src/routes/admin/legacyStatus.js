'use strict';

const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { ADMIN_UI_ROUTES_V2, buildAdminAppPaneLocation, resolveLegacyHtmlForAdminRoute } = require('../../shared/adminUiRoutesV2');

const LEGACY_ITEMS = Object.freeze(
  ADMIN_UI_ROUTES_V2
    .filter((entry) => entry && entry.route !== '/admin/app')
    .map((entry) => {
      const compatLegacyHtml = resolveLegacyHtmlForAdminRoute(entry.route);
      const hasCompatLegacy = typeof compatLegacyHtml === 'string' && compatLegacyHtml.length > 0;
      return Object.freeze({
        path: entry.route,
        mode: hasCompatLegacy ? 'redirect_with_compat' : 'redirect',
        target: buildAdminAppPaneLocation(entry.pane),
        status: hasCompatLegacy ? 'compat_legacy' : 'legacy_redirect',
        legacySource: entry.legacySource || null
      });
    })
);

async function handleLegacyStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  const summary = {
    total: LEGACY_ITEMS.length,
    legacyHtmlCount: LEGACY_ITEMS.filter((item) => item.mode === 'redirect_with_compat').length,
    redirectCount: LEGACY_ITEMS.filter((item) => String(item.mode || '').startsWith('redirect')).length
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
