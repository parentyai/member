'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase653: admin app boot exposes no-collapse/top-summary flags and UI enforces no-fold behavior', () => {
  const indexSrc = fs.readFileSync('src/index.js', 'utf8');
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(indexSrc.includes("resolveBooleanEnvFlag('ENABLE_ADMIN_NO_COLLAPSE_V1', true)"));
  assert.ok(indexSrc.includes("resolveBooleanEnvFlag('ENABLE_ADMIN_TOP_SUMMARY_V1', false)"));
  assert.ok(indexSrc.includes('window.ENABLE_ADMIN_NO_COLLAPSE_V1='));
  assert.ok(indexSrc.includes('window.ENABLE_ADMIN_TOP_SUMMARY_V1='));

  assert.ok(html.includes('id="topbar-summary-line"'));

  assert.ok(js.includes('const ADMIN_NO_COLLAPSE_V1 = resolveFrontendFeatureFlag('));
  assert.ok(js.includes('const ADMIN_TOP_SUMMARY_V1 = resolveFrontendFeatureFlag('));
  assert.ok(js.includes('function enforceNoCollapseUi()'));
  assert.ok(js.includes("summaryEl.setAttribute('aria-disabled', 'true');"));
  assert.ok(js.includes('function applyTopSummaryVisibility()'));
  assert.ok(js.includes("summaryLine.classList.add('is-hidden-by-flag');"));
  assert.ok(js.includes('applyTopSummaryVisibility();'));
  assert.ok(js.includes('enforceNoCollapseUi();'));

  assert.ok(css.includes('.admin-no-collapse-v1 details > summary'));
  assert.ok(css.includes('.top-summary-line.is-hidden-by-flag'));
});
