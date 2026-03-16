'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const LEDGER_JSON = 'ui_screenshot_evidence_index_v2.json';
const FOLD_METRICS_JSON = 'docs/REPO_AUDIT_INPUTS/ui_pr11_fold_noise_role_surface_1440x900.json';
const RUNBOOK_DOC = 'docs/RUNBOOK_ADMIN_OPS.md';
const ROLLBACK_DOC = 'docs/UI_MIGRATION_AND_ROLLBACK_PLAN.md';
const CAPTURE_SET = 'ui-pr11-hardening-20260316';

const ROLES = ['operator', 'admin', 'developer'];
const PANES = [
  'home',
  'composer',
  'monitor',
  'city-pack',
  'vendors',
  'read-model',
  'alerts',
  'errors',
  'llm',
  'settings',
  'maintenance',
  'audit',
  'ops-feature-catalog',
  'ops-system-health'
];

test('phase674: PR11 capture set keeps 14 surfaces x 3 roles evidence matrix', () => {
  const rows = JSON.parse(fs.readFileSync(LEDGER_JSON, 'utf8'))
    .filter((row) => row.captureSet === CAPTURE_SET);

  assert.equal(rows.length, 42, 'PR11 evidence set must keep exactly 42 screenshots');

  const roleCounts = new Map();
  const paneRolePairs = new Set();
  const paneCoverage = new Map();
  for (const row of rows) {
    roleCounts.set(row.role, (roleCounts.get(row.role) || 0) + 1);
    paneRolePairs.add(`${row.surfaceSlug}:${row.role}`);
    if (!paneCoverage.has(row.surfaceSlug)) paneCoverage.set(row.surfaceSlug, new Set());
    paneCoverage.get(row.surfaceSlug).add(row.role);
    assert.equal(row.viewport, '1440x900');
    assert.ok(row.filePath.startsWith(`artifacts/${CAPTURE_SET}/screenshots/`));
    assert.ok(row.filePath.endsWith('.png'));
  }

  ROLES.forEach((role) => {
    assert.equal(roleCounts.get(role), 14, `role ${role} must keep 14 pane screenshots`);
  });
  PANES.forEach((pane) => {
    ROLES.forEach((role) => {
      assert.ok(paneRolePairs.has(`${pane}:${role}`), `missing screenshot: pane=${pane} role=${role}`);
    });
    assert.equal((paneCoverage.get(pane) || new Set()).size, 3, `pane ${pane} must be observed by all roles`);
  });
});

test('phase674: PR11 fold-noise metrics keep target 4 panes non-regressive in first view', () => {
  const metrics = JSON.parse(fs.readFileSync(FOLD_METRICS_JSON, 'utf8'));
  assert.equal(metrics.captureSet, CAPTURE_SET);
  assert.equal(metrics.sampleCount, 42);
  assert.deepEqual(metrics.roles, ROLES);
  assert.deepEqual(metrics.panes, PANES);

  const rowByKey = new Map(metrics.rows.map((row) => [`${row.pane}:${row.role}`, row]));
  ['monitor', 'audit', 'llm', 'settings'].forEach((pane) => {
    ROLES.forEach((role) => {
      const row = rowByKey.get(`${pane}:${role}`);
      assert.ok(row, `missing fold-noise row: pane=${pane} role=${role}`);
      assert.equal(row.preInFold, 0);
      assert.equal(row.textareaInFold, 0);
      assert.equal(row.detailsOpenInFold, 1);
    });
  });
});

test('phase674: PR11 runbook and rollback docs include one-shot release gate and PR11->PR8 rollback order', () => {
  const runbook = fs.readFileSync(RUNBOOK_DOC, 'utf8');
  const rollback = fs.readFileSync(ROLLBACK_DOC, 'utf8');

  assert.ok(runbook.includes('## PR11 One-shot Release Gate（hardening）'));
  assert.ok(runbook.includes('14面×3role Playwright最小回帰'));
  assert.ok(runbook.includes('ui-pr11-hardening-20260316'));

  assert.ok(rollback.includes('PR11: hardening + one-shot release gate'));
  assert.ok(rollback.includes('git revert <PR11 merge commit>'));
  assert.ok(rollback.includes('git revert <PR8 merge commit>'));
});
