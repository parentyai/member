'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildExecutionPlan,
  buildToolCall,
  getReadinessResult,
  parseArgs,
} = require('../../tools/line_desktop_patrol/run_local_mcp_tool');

test('phase857: local runner maps desktop-readiness to the readiness MCP tool', () => {
  const args = parseArgs(['desktop-readiness', '--target-alias', 'sample-self-test']);
  const call = buildToolCall(args);
  assert.equal(call.name, 'desktop_readiness');
  assert.deepEqual(call.arguments, { target_alias: 'sample-self-test' });
});

test('phase857: local runner defaults target confirmation to target alias for desktop loop', () => {
  const args = parseArgs([
    'desktop-loop',
    '--target-alias', 'sample-self-test',
    '--text', 'hello',
    '--send-mode', 'dry_run',
    '--observe-seconds', '10',
    '--expected-reply-substring', '了解',
    '--forbidden-reply-substring', '禁止',
  ]);
  const call = buildToolCall(args);
  assert.equal(call.name, 'desktop_run_conversation_loop');
  assert.equal(call.arguments.target_alias, 'sample-self-test');
  assert.equal(call.arguments.target_confirmation, 'sample-self-test');
  assert.equal(call.arguments.send_mode, 'dry_run');
  assert.equal(call.arguments.observe_seconds, 10);
  assert.deepEqual(call.arguments.expected_reply_substrings, ['了解']);
  assert.deepEqual(call.arguments.forbidden_reply_substrings, ['禁止']);
});

test('phase857: desktop self test plans readiness before desktop loop in one flow', () => {
  const args = parseArgs([
    'desktop-self-test',
    '--target-alias', 'sample-self-test',
    '--text', 'hello',
    '--send-mode', 'dry_run',
    '--observe-seconds', '12',
  ]);
  const plan = buildExecutionPlan(args);
  assert.equal(plan.kind, 'flow');
  assert.equal(plan.name, 'desktop_self_test');
  assert.equal(plan.calls[0].name, 'desktop_readiness');
  assert.deepEqual(plan.calls[0].arguments, { target_alias: 'sample-self-test' });
  assert.equal(plan.calls[1].name, 'desktop_run_conversation_loop');
  assert.equal(plan.calls[1].arguments.target_alias, 'sample-self-test');
  assert.equal(plan.calls[1].arguments.target_confirmation, 'sample-self-test');
  assert.equal(plan.calls[1].arguments.observe_seconds, 12);
});

test('phase857: readiness helper unwraps nested MCP readiness payloads', () => {
  const result = getReadinessResult({
    ok: true,
    targetAlias: 'sample-self-test',
    result: {
      ok: true,
      ready: true,
      expectedTitleMatched: true,
    },
  });
  assert.equal(result.ready, true);
  assert.equal(result.expectedTitleMatched, true);
});
