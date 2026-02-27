'use strict';

const ADMIN_UI_ROUTES_V2 = Object.freeze([
  Object.freeze({
    route: '/admin/app',
    type: 'app_shell',
    pane: 'home',
    legacySource: 'apps/admin/app.html',
    notes: 'Canonical runtime shell for all admin UI panes.'
  }),
  Object.freeze({
    route: '/admin/ops',
    type: 'redirect_to_app_pane',
    pane: 'home',
    legacySource: 'apps/admin/ops_readonly.html',
    notes: 'Primary legacy entrypoint now converges to app home pane.'
  }),
  Object.freeze({
    route: '/admin/ops_readonly',
    type: 'redirect_to_app_pane',
    pane: 'home',
    legacySource: 'apps/admin/ops_readonly.html',
    notes: 'Legacy file-path bookmark compatibility alias for ops_readonly.html.'
  }),
  Object.freeze({
    route: '/admin/composer',
    type: 'redirect_to_app_pane',
    pane: 'composer',
    legacySource: 'apps/admin/composer.html',
    notes: 'Composer route converges to composer pane.'
  }),
  Object.freeze({
    route: '/admin/monitor',
    type: 'redirect_to_app_pane',
    pane: 'monitor',
    legacySource: 'apps/admin/monitor.html',
    notes: 'Monitor route converges to monitor pane.'
  }),
  Object.freeze({
    route: '/admin/errors',
    type: 'redirect_to_app_pane',
    pane: 'errors',
    legacySource: 'apps/admin/errors.html',
    notes: 'Errors route converges to errors pane.'
  }),
  Object.freeze({
    route: '/admin/read-model',
    type: 'redirect_to_app_pane',
    pane: 'read-model',
    legacySource: 'apps/admin/read_model.html',
    notes: 'Read model route converges to read-model pane.'
  }),
  Object.freeze({
    route: '/admin/master',
    type: 'redirect_to_app_pane',
    pane: 'maintenance',
    legacySource: 'apps/admin/master.html',
    notes: 'Master operations converge to maintenance pane (settings/recovery).'
  }),
  Object.freeze({
    route: '/admin/review',
    type: 'redirect_to_app_pane',
    pane: 'audit',
    legacySource: 'apps/admin/review.html',
    notes: 'Review records converge to audit pane.'
  })
]);

const ADMIN_UI_ROUTE_INDEX = Object.freeze(ADMIN_UI_ROUTES_V2.reduce((acc, entry) => {
  acc[entry.route] = entry;
  return acc;
}, Object.create(null)));

const ADMIN_UI_COMPAT_LEGACY_HTML = Object.freeze({
  '/admin/master': 'master.html',
  '/admin/review': 'review.html',
  '/admin/ops': 'ops_readonly.html',
  '/admin/ops_readonly': 'ops_readonly.html'
});

function normalizeAdminRoute(pathname) {
  const raw = String(pathname || '').trim();
  if (!raw || raw === '/') return '/';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function resolveAdminUiRoute(pathname) {
  const normalized = normalizeAdminRoute(pathname);
  return ADMIN_UI_ROUTE_INDEX[normalized] || null;
}

function buildAdminAppPaneLocation(pane) {
  const normalizedPane = String(pane || '').trim();
  if (!normalizedPane || normalizedPane === 'home') return '/admin/app';
  const params = new URLSearchParams({ pane: normalizedPane });
  return `/admin/app?${params.toString()}`;
}

function resolveLegacyHtmlForAdminRoute(pathname) {
  const normalized = normalizeAdminRoute(pathname);
  return ADMIN_UI_COMPAT_LEGACY_HTML[normalized] || null;
}

module.exports = {
  ADMIN_UI_ROUTES_V2,
  ADMIN_UI_COMPAT_LEGACY_HTML,
  normalizeAdminRoute,
  resolveAdminUiRoute,
  buildAdminAppPaneLocation,
  resolveLegacyHtmlForAdminRoute
};
