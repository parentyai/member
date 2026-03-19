'use strict';

const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { ADMIN_UI_ROUTES_V2, buildAdminAppPaneLocation, resolveLegacyHtmlForAdminRoute } = require('../../shared/adminUiRoutesV2');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.legacy_status';

const LEGACY_ITEMS = Object.freeze(
  ADMIN_UI_ROUTES_V2
    .filter((entry) => entry && entry.route !== '/admin/app')
    .map((entry) => {
      const compatLegacyHtml = resolveLegacyHtmlForAdminRoute(entry.route);
      const hasCompatLegacy = typeof compatLegacyHtml === 'string' && compatLegacyHtml.length > 0;
      const successor = buildAdminAppPaneLocation(entry.pane);
      return Object.freeze({
        path: entry.route,
        mode: hasCompatLegacy ? 'redirect_with_compat' : 'redirect',
        target: successor,
        successor,
        status: hasCompatLegacy ? 'compat_legacy' : 'legacy_redirect',
        legacySource: entry.legacySource || null,
        caution: hasCompatLegacy
          ? 'legacy_html_compat_is_frozen'
          : 'redirect_only_frozen',
        frozen: true,
        ssotRef: 'docs/SSOT_ADMIN_UI_ROUTES_V2.md'
      });
    })
);

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleLegacyStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  const summary = {
    total: LEGACY_ITEMS.length,
    frozenCount: LEGACY_ITEMS.filter((item) => item.frozen === true).length,
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

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      generatedAt: new Date().toISOString(),
      summary,
      items: LEGACY_ITEMS
    }, { state: 'success', reason: 'completed' });
  } catch (err) {
    logRouteError('admin.legacy_status.view', err, { actor, traceId, requestId });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, { state: 'error', reason: 'error' });
  }
}

module.exports = {
  handleLegacyStatus
};
