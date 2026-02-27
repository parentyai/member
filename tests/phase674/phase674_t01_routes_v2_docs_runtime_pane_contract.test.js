'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  ADMIN_UI_ROUTES_V2,
  buildAdminAppPaneLocation
} = require('../../src/shared/adminUiRoutesV2');

function parseJsonBlock(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) return null;
  const body = text.slice(start + startMarker.length, end).trim();
  return JSON.parse(body);
}

function normalizeDocEntry(entry) {
  return {
    route: entry.route,
    type: entry.type,
    pane: entry.pane,
    legacySource: Object.prototype.hasOwnProperty.call(entry, 'legacy_source') ? entry.legacy_source : null
  };
}

function normalizeRuntimeEntry(entry) {
  return {
    route: entry.route,
    type: entry.type,
    pane: entry.pane,
    legacySource: Object.prototype.hasOwnProperty.call(entry, 'legacySource') ? entry.legacySource : null
  };
}

test('phase674: routes v2 doc/runtime/pane contract stay aligned', () => {
  const doc = fs.readFileSync('docs/SSOT_ADMIN_UI_ROUTES_V2.md', 'utf8');
  const app = fs.readFileSync('apps/admin/app.html', 'utf8');

  const docRoutes = parseJsonBlock(
    doc,
    '<!-- ADMIN_UI_ROUTES_V2_BEGIN -->',
    '<!-- ADMIN_UI_ROUTES_V2_END -->'
  );
  assert.ok(Array.isArray(docRoutes) && docRoutes.length > 0, 'ROUTES_V2 block missing/empty');

  const docNormalized = docRoutes.map(normalizeDocEntry).sort((a, b) => a.route.localeCompare(b.route));
  const runtimeNormalized = ADMIN_UI_ROUTES_V2.map(normalizeRuntimeEntry).sort((a, b) => a.route.localeCompare(b.route));
  assert.deepEqual(runtimeNormalized, docNormalized, 'docs/routes_v2 mismatch');

  const paneValues = new Set();
  const paneRegex = /data-pane="([^"]+)"/g;
  let paneMatch;
  while ((paneMatch = paneRegex.exec(app)) !== null) paneValues.add(paneMatch[1]);

  const missingPanes = Array.from(new Set(docRoutes.map((entry) => entry.pane))).filter((pane) => !paneValues.has(pane));
  assert.deepEqual(missingPanes, [], `missing panes in app.html: ${missingPanes.join(', ')}`);

  const requiredRoutes = [
    '/admin/ops',
    '/admin/ops_readonly',
    '/admin/composer',
    '/admin/monitor',
    '/admin/errors',
    '/admin/read-model',
    '/admin/master',
    '/admin/review'
  ];
  const docPaths = docRoutes.map((entry) => entry.route);
  const uncovered = requiredRoutes.filter((route) => !docPaths.includes(route));
  assert.deepEqual(uncovered, [], `uncovered admin routes: ${uncovered.join(', ')}`);

  const redirectTargets = docRoutes
    .filter((entry) => entry.type === 'redirect_to_app_pane')
    .map((entry) => buildAdminAppPaneLocation(entry.pane));
  assert.ok(redirectTargets.every((target) => target.startsWith('/admin/app')), 'redirect target must stay in /admin/app');
});
