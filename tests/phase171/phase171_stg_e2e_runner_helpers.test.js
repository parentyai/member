'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  parseArgs,
  buildTraceId,
  evaluateExitCode,
  renderMarkdownSummary,
  buildActiveQuietHours,
  normalizeNotificationCaps,
  resolveOutFile
} = require('../../tools/run_stg_notification_e2e_checklist');

test('phase171: parseArgs reads env defaults and supports skip flags', () => {
  const args = parseArgs([
    'node',
    'tools/run_stg_notification_e2e_checklist.js',
    '--skip-segment',
    '--allow-skip',
    '--expect-llm-enabled',
    '--trace-prefix',
    'trace-custom'
  ], {
    ADMIN_OS_TOKEN: 'token_x',
    MEMBER_BASE_URL: 'http://127.0.0.1:18080/'
  });

  assert.strictEqual(args.adminToken, 'token_x');
  assert.strictEqual(args.baseUrl, 'http://127.0.0.1:18080');
  assert.strictEqual(args.skipSegment, true);
  assert.strictEqual(args.allowSkip, true);
  assert.strictEqual(args.expectLlmEnabled, true);
  assert.strictEqual(args.tracePrefix, 'trace-custom');
});

test('phase171: parseArgs supports E2E_EXPECT_LLM_ENABLED env default', () => {
  const args = parseArgs([
    'node',
    'tools/run_stg_notification_e2e_checklist.js'
  ], {
    ADMIN_OS_TOKEN: 'token_x',
    E2E_EXPECT_LLM_ENABLED: '1'
  });

  assert.strictEqual(args.expectLlmEnabled, true);
});

test('phase171: parseArgs requires admin token', () => {
  assert.throws(() => parseArgs([
    'node',
    'tools/run_stg_notification_e2e_checklist.js'
  ], {}), /admin token required/);
});

test('phase171: buildTraceId is stable format', () => {
  const traceId = buildTraceId('trace-prefix', 'kill_switch', '2026-02-12T03:04:05.000Z');
  assert.match(traceId, /^trace-prefix-kill-switch-\d{14}$/);
});

test('phase171: evaluateExitCode treats skip as failure in strict mode', () => {
  const strictCode = evaluateExitCode([{ status: 'PASS' }, { status: 'SKIP' }], false);
  const allowSkipCode = evaluateExitCode([{ status: 'PASS' }, { status: 'SKIP' }], true);
  const failCode = evaluateExitCode([{ status: 'PASS' }, { status: 'FAIL' }], true);

  assert.strictEqual(strictCode, 1);
  assert.strictEqual(allowSkipCode, 0);
  assert.strictEqual(failCode, 1);
});

test('phase171: markdown summary includes scenario status and trace', () => {
  const markdown = renderMarkdownSummary({
    endedAt: '2026-02-12T03:04:05.000Z',
    baseUrl: 'http://127.0.0.1:18080',
    actor: 'ops',
    headSha: 'abc123',
    scenarios: [
      {
        name: 'segment',
        status: 'PASS',
        traceId: 'trace-segment',
        traceBundle: { audits: 3, decisions: 1, timeline: 2 }
      }
    ]
  });

  assert.match(markdown, /segment/);
  assert.match(markdown, /status: PASS/);
  assert.match(markdown, /trace-segment/);
  assert.match(markdown, /audits=3 decisions=1 timeline=2/);
});

test('phase171: normalizeNotificationCaps and buildActiveQuietHours are add-only safe', () => {
  const quietHours = buildActiveQuietHours(new Date('2026-02-12T23:00:00.000Z'));
  const caps = normalizeNotificationCaps({
    perUserWeeklyCap: 3,
    quietHours
  });

  assert.deepStrictEqual(quietHours, { startHourUtc: 23, endHourUtc: 0 });
  assert.deepStrictEqual(caps, {
    perUserWeeklyCap: 3,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: { startHourUtc: 23, endHourUtc: 0 }
  });
});

test('phase171: resolveOutFile uses default artifacts directory', () => {
  const out = resolveOutFile({ outFile: '' });
  assert.match(out, /^artifacts\/stg-notification-e2e\/stg-notification-e2e-\d{14}\.json$/);
});
