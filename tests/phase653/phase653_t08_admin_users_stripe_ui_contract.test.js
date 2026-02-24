'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase653: admin users ui includes quick filters/analyze/export/edit-columns and unknown emphasis', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(html.includes('id="users-summary-quick-filters"'));
  assert.ok(html.includes('data-users-quick-filter="pro_active"'));
  assert.ok(html.includes('data-users-quick-filter="unknown"'));
  assert.ok(html.includes('id="users-summary-analyze"'));
  assert.ok(html.includes('id="users-summary-export"'));
  assert.ok(html.includes('id="users-summary-edit-columns"'));
  assert.ok(html.includes('id="users-filter-billing-integrity"'));
  assert.ok(html.includes('data-users-sort-key="llmUsageToday"'));
  assert.ok(html.includes('data-users-sort-key="tokensToday"'));
  assert.ok(html.includes('data-users-sort-key="blockedRate"'));
  assert.ok(html.includes('data-users-sort-key="billingIntegrity"'));
  assert.ok(html.includes('id="users-summary-columns-panel"'));

  assert.ok(js.includes('usersSummaryQuickFilter'));
  assert.ok(js.includes('usersSummaryVisibleColumns'));
  assert.ok(js.includes('loadUsersSummaryAnalyze('));
  assert.ok(js.includes('exportUsersSummaryCsv('));
  assert.ok(js.includes("/api/admin/os/users-summary/analyze"));
  assert.ok(js.includes("/api/admin/os/users-summary/export"));
  assert.ok(js.includes('buildUsersSummaryQuery('));
  assert.ok(js.includes("query.set('quickFilter'"));

  assert.ok(css.includes('.users-quick-filters'));
  assert.ok(css.includes('.users-quick-filter-pill-unknown'));
  assert.ok(css.includes('.users-badge-conflict'));
  assert.ok(css.includes('.users-row-unknown'));
});
