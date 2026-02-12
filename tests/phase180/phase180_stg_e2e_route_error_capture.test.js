'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  parseArgs,
  renderMarkdownSummary,
  buildRouteErrorLoggingFilter,
  fetchRouteErrors
} = require('../../tools/run_stg_notification_e2e_checklist');

test('phase180: parseArgs accepts route_error options', () => {
  const args = parseArgs([
    'node',
    'tools/run_stg_notification_e2e_checklist.js',
    '--fetch-route-errors',
    '--project-id',
    'member-485303',
    '--route-error-limit',
    '15'
  ], {
    ADMIN_OS_TOKEN: 'token_x'
  });

  assert.strictEqual(args.fetchRouteErrors, true);
  assert.strictEqual(args.projectId, 'member-485303');
  assert.strictEqual(args.routeErrorLimit, 15);
});

test('phase180: parseArgs rejects fetch-route-errors without project id', () => {
  assert.throws(() => parseArgs([
    'node',
    'tools/run_stg_notification_e2e_checklist.js',
    '--fetch-route-errors'
  ], {
    ADMIN_OS_TOKEN: 'token_x',
    GCP_PROJECT_ID: ''
  }), /project id required/);
});

test('phase180: buildRouteErrorLoggingFilter contains route_error prefix and trace id', () => {
  const filter = buildRouteErrorLoggingFilter('trace-stg-e2e-segment-20260212160500');
  assert.match(filter, /\[route_error\]/);
  assert.match(filter, /traceId=trace-stg-e2e-segment-20260212160500/);
});

test('phase180: fetchRouteErrors parses gcloud output lines', () => {
  const result = fetchRouteErrors({
    fetchRouteErrors: true,
    projectId: 'member-485303',
    routeErrorLimit: 20
  }, 'trace-1', () => 'line-a\n\nline-b\n');

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.count, 2);
  assert.deepStrictEqual(result.lines, ['line-a', 'line-b']);
});

test('phase180: markdown summary prints route_error capture status', () => {
  const markdown = renderMarkdownSummary({
    endedAt: '2026-02-12T16:05:00.000Z',
    baseUrl: 'http://127.0.0.1:18080',
    actor: 'ops',
    headSha: 'abc123',
    scenarios: [
      {
        name: 'segment',
        status: 'FAIL',
        traceId: 'trace-segment',
        reason: 'segment_execute_not_ok:notification_policy_blocked',
        traceBundle: { audits: 4, decisions: 0, timeline: 0 },
        routeErrors: { ok: true, count: 2, lines: ['line-a', 'line-b'] }
      }
    ]
  });

  assert.match(markdown, /route_error logs: count=2/);
});
