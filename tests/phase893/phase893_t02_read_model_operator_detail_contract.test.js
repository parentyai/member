'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase893: read-model operator detail rail keeps primary fields and hides technical lines in ops shell', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="users-detail-next-check"'), 'read-model detail should expose next check');
  assert.ok(html.includes('class="note users-detail-primary">次の確認:'), 'next check label missing');
  assert.ok(html.includes('class="note users-detail-technical">問い合わせ回数:'), 'technical usage label should be classified');
  assert.ok(html.includes('class="note users-detail-secondary">世帯区分:'), 'secondary journey label should be classified');

  assert.ok(css.includes('#pane-read-model .users-detail-technical'), 'ops shell should hide technical detail rows');
  assert.ok(css.includes('#pane-read-model .users-detail-secondary'), 'ops shell should hide secondary detail rows');
  assert.ok(js.includes("setTextContent('users-detail-next-check', nextCheckValue);"), 'runtime should populate next check value');
  assert.ok(js.includes("usersSummaryVisibleColumns: [\n    'lineUserId',\n    'plan',\n    'subscriptionStatus',\n    'reactionRate',\n    'llmUsage',\n    'nextCheck'\n  ]"), 'ops default columns should stay minimal');
  assert.ok(js.includes('function applyOperatorStaticTableHeaders() {'), 'operator static table header helper missing');
  assert.ok(css.includes('.users-summary-table .table-sort-btn.is-operator-static'), 'ops shell should hide sort buttons for read-model first-view');
  assert.ok(css.includes('.users-summary-table .operator-col-label'), 'ops shell should render plain text column labels');
  assert.ok(css.includes('th[data-users-col="createdAt"]'), 'ops shell should hide non-operator columns from the read-model table');
  assert.ok(css.includes('.read-model-workspace-grid.is-detail-empty'), 'ops shell should collapse the empty detail rail');
  assert.ok(js.includes("function syncUsersSummaryDetailRailVisibility(hasDetail) {"), 'runtime should expose a helper for detail rail visibility');
  assert.ok(js.includes("workspaceGrid.classList.toggle('is-detail-empty', isOpsShellActive() && !visible);"), 'runtime should collapse detail rail until a member is selected');
  assert.ok(js.includes(": (!isOpsShellActive() && state.usersSummaryItems[0] && state.usersSummaryItems[0].lineUserId"), 'ops shell should not auto-open the first member detail');
  assert.ok(js.includes("if (nextPane === 'read-model' && isOpsShellActive()) {"), 'read-model pane activation should reset operator detail focus');
  assert.ok(html.includes('data-users-quick-filter="pro_active"'), 'paid member quick filter missing');
  assert.ok(html.includes('data-users-quick-filter="past_due"'), 'past due quick filter missing');
  assert.ok(!html.includes('data-users-quick-filter="trialing"'), 'trialing quick filter should be removed from first-view');
});
