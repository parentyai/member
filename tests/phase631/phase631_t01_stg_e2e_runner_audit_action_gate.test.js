'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  parseArgs,
  evaluateAuditActionCoverage,
  applyAuditCoverageGate,
  getRequiredAuditActionsForScenario
} = require('../../tools/run_stg_notification_e2e_checklist');

test('phase631: parseArgs accepts strict audit action and trace limit options', () => {
  const args = parseArgs([
    'node',
    'tools/run_stg_notification_e2e_checklist.js',
    '--project-id',
    'member-485303',
    '--fail-on-missing-audit-actions',
    '--expect-llm-enabled',
    '--trace-limit',
    '250'
  ], {
    ADMIN_OS_TOKEN: 'token_x'
  });

  assert.strictEqual(args.failOnMissingAuditActions, true);
  assert.strictEqual(args.expectLlmEnabled, true);
  assert.strictEqual(args.traceLimit, 250);
});

test('phase631: parseArgs rejects invalid trace limit range', () => {
  assert.throws(() => parseArgs([
    'node',
    'tools/run_stg_notification_e2e_checklist.js',
    '--trace-limit',
    '0'
  ], {
    ADMIN_OS_TOKEN: 'token_x'
  }), /--trace-limit must be integer 1-500/);
});

test('phase631: required audit action map resolves scenario keys', () => {
  const actions = getRequiredAuditActionsForScenario('segment');
  assert.deepStrictEqual(actions, ['segment_send.plan', 'segment_send.dry_run', 'segment_send.execute']);
});

test('phase631: strict audit gate marks missing action as fail', () => {
  const coverage = evaluateAuditActionCoverage(
    ['segment_send.plan', 'segment_send.execute'],
    ['segment_send.plan', 'segment_send.dry_run', 'segment_send.execute']
  );
  const gated = applyAuditCoverageGate('PASS', null, coverage, true);

  assert.strictEqual(coverage.ok, false);
  assert.deepStrictEqual(coverage.missing, ['segment_send.dry_run']);
  assert.strictEqual(gated.status, 'FAIL');
  assert.strictEqual(gated.reason, 'missing_audit_actions:segment_send.dry_run');
});

test('phase631: strict audit gate preserves existing reason on failure', () => {
  const coverage = evaluateAuditActionCoverage([], ['retry_queue.plan']);
  const gated = applyAuditCoverageGate('FAIL', 'retry_execute_unexpected_reason:x', coverage, true);
  assert.strictEqual(gated.status, 'FAIL');
  assert.strictEqual(gated.reason, 'retry_execute_unexpected_reason:x');
});
