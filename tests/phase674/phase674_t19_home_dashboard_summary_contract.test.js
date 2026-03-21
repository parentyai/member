'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: local preflight banner supports summary-first detail toggle contract', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(html.includes('id="local-preflight-summary-code"'));
  assert.ok(html.includes('id="local-preflight-summary-cause"'));
  assert.ok(html.includes('id="local-preflight-toggle-detail"'));
  assert.ok(html.includes('id="local-preflight-detail-panel"'));

  assert.ok(js.includes('function setLocalPreflightDetailExpanded(expanded)'));
  assert.ok(js.includes("document.getElementById('local-preflight-toggle-detail')"));
  assert.ok(js.includes("localPreflightDetailExpanded"));

  assert.ok(css.includes('.admin-local-preflight-summary'));
  assert.ok(css.includes('.admin-local-preflight-detail.is-collapsed'));
});

test('phase674: page header keeps dashboard entry as read-only deep links', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const actionMapStart = js.indexOf('const PAGE_HEADER_ACTION_MAP = Object.freeze({');
  const homeMapStart = js.indexOf('home: Object.freeze({', actionMapStart);
  const homeMapEnd = js.indexOf("'city-pack': Object.freeze({", homeMapStart);
  const homeMap = homeMapStart >= 0 && homeMapEnd > homeMapStart
    ? js.slice(homeMapStart, homeMapEnd)
    : '';

  assert.ok(js.includes('const PAGE_HEADER_ACTION_MAP = Object.freeze('));
  assert.ok(homeMap.includes("labelKey: 'ui.label.alerts.title'"));
  assert.ok(homeMap.includes("paneTarget: 'alerts'"));
  assert.ok(homeMap.includes("paneTarget: 'monitor'"));
  assert.ok(!homeMap.includes("paneTarget: 'composer'"));
  assert.ok(js.includes("buttonEl.getAttribute('data-open-pane')"));

  assert.ok(css.includes('.app-shell.home-clean-surface-v1 #home-decision-card .decision-actions'));
  assert.ok(css.includes('.app-shell.home-clean-surface-v1[data-view-pane="home"] #managed-action-evidence'));
});
