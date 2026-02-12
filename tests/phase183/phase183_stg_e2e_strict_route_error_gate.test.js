'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  parseArgs,
  applyRouteErrorStrictGate
} = require('../../tools/run_stg_notification_e2e_checklist');

test('phase183: parseArgs enables fetchRouteErrors when fail-on-route-errors is set', () => {
  const args = parseArgs([
    'node',
    'tools/run_stg_notification_e2e_checklist.js',
    '--fail-on-route-errors',
    '--project-id',
    'member-485303'
  ], {
    ADMIN_OS_TOKEN: 'token_x'
  });

  assert.strictEqual(args.failOnRouteErrors, true);
  assert.strictEqual(args.fetchRouteErrors, true);
  assert.strictEqual(args.projectId, 'member-485303');
});

test('phase183: parseArgs rejects fail-on-route-errors without project id', () => {
  assert.throws(() => parseArgs([
    'node',
    'tools/run_stg_notification_e2e_checklist.js',
    '--fail-on-route-errors'
  ], {
    ADMIN_OS_TOKEN: 'token_x',
    GCP_PROJECT_ID: ''
  }), /project id required/);
});

test('phase183: strict gate marks PASS as FAIL when route_error is detected', () => {
  const result = applyRouteErrorStrictGate('PASS', null, { ok: true, count: 2 }, true);
  assert.strictEqual(result.status, 'FAIL');
  assert.strictEqual(result.reason, 'route_error_detected:2');
});

test('phase183: strict gate keeps original reason for already failed scenario', () => {
  const result = applyRouteErrorStrictGate(
    'FAIL',
    'segment_execute_not_ok:notification_policy_blocked',
    { ok: false, reason: 'gcloud_logging_read_failed' },
    true
  );
  assert.strictEqual(result.status, 'FAIL');
  assert.strictEqual(result.reason, 'segment_execute_not_ok:notification_policy_blocked');
});

test('phase183: strict gate is no-op when strict mode is disabled', () => {
  const result = applyRouteErrorStrictGate('PASS', null, null, false);
  assert.strictEqual(result.status, 'PASS');
  assert.strictEqual(result.reason, null);
});
