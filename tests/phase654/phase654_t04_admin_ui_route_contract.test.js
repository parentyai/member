'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase654: index wiring includes snapshot recompress and llm policy history routes', () => {
  const src = read('src/index.js');
  assert.ok(src.includes("pathname === '/internal/jobs/user-context-snapshot-recompress'"));
  assert.ok(src.includes("pathname === '/api/admin/os/llm-policy/history'"));
  assert.ok(src.includes("pathname === '/api/admin/llm/policy/history'"));
});

test('phase654: admin ui keeps dashboard summary/users/llm-history elements without fold ui', () => {
  const html = read('apps/admin/app.html');
  assert.ok(html.includes('data-dashboard-card="avgTaskCompletion"'));
  assert.ok(html.includes('data-dashboard-card="dependencyBlockRate"'));
  assert.ok(html.includes('id="dashboard-summary-open-alerts"'));
  assert.ok(html.includes('id="dashboard-summary-scheduled-today"'));
  assert.ok(html.includes('id="dashboard-summary-registered-count"'));
  assert.ok(!html.includes('id="dashboard-journey-task-completion"'));
  assert.ok(!html.includes('id="dashboard-journey-dependency-block"'));
  assert.ok(html.includes('data-users-column-toggle="llmUsage"'));
  assert.ok(html.includes('data-users-column-toggle="todoProgressRate"'));
  assert.ok(html.includes('data-users-column-toggle="localGuidanceCoverage"'));
  assert.ok(!html.includes('id="dashboard-journey-next-action-72h"'));
  assert.ok(!html.includes('id="dashboard-journey-blocker-resolution-hours"'));
  assert.ok(!html.includes('id="dashboard-journey-local-open-rate"'));
  assert.ok(!html.includes('id="dashboard-journey-notification-fatigue"'));
  assert.ok(html.includes('id="llm-policy-history"'));
  assert.ok(html.includes('id="llm-policy-history-result"'));
});

test('phase654: admin app maps users summary fields with defined variables and policy history fetch', () => {
  const src = read('apps/admin/assets/admin_app.js');
  assert.ok(src.includes('const householdType = normalizeHouseholdType(row.householdType);'));
  assert.ok(src.includes('const journeyStage = normalizeJourneyStage(row.journeyStage);'));
  assert.ok(src.includes('const todoOpenCount = Number(row.todoOpenCount);'));
  assert.ok(src.includes('const todoOverdueCount = Number(row.todoOverdueCount);'));
  assert.ok(src.includes('const llmUsage = Number(row.llmUsage);'));
  assert.ok(src.includes('const todoProgressRate = Number(row.todoProgressRate);'));
  assert.ok(src.includes('const localGuidanceCoverage = Number(row.localGuidanceCoverage);'));
  assert.ok(src.includes("fetch('/api/admin/os/llm-policy/history?limit=20'"));
});

test('phase654: admin css right-aligns new users numeric columns', () => {
  const css = read('apps/admin/assets/admin.css');
  assert.ok(css.includes('td[data-users-col="llmUsage"]'));
  assert.ok(css.includes('td[data-users-col="todoProgressRate"]'));
  assert.ok(css.includes('td[data-users-col="localGuidanceCoverage"]'));
});
