'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const {
  parseArgs,
  getRequiredAuditActionsForScenario
} = require('../../tools/run_stg_notification_e2e_checklist');

test('phase650: parseArgs resolves expectLlmEnabled from env and cli', () => {
  const byEnv = parseArgs(
    ['node', 'tools/run_stg_notification_e2e_checklist.js'],
    { ADMIN_OS_TOKEN: 'token_x', E2E_EXPECT_LLM_ENABLED: '1' }
  );
  assert.strictEqual(byEnv.expectLlmEnabled, true);

  const byCli = parseArgs(
    ['node', 'tools/run_stg_notification_e2e_checklist.js', '--expect-llm-enabled'],
    { ADMIN_OS_TOKEN: 'token_x' }
  );
  assert.strictEqual(byCli.expectLlmEnabled, true);
});

test('phase650: llm_gate required audit actions are fixed', () => {
  assert.deepStrictEqual(
    getRequiredAuditActionsForScenario('llm_gate'),
    ['llm_config.status.view', 'llm_disclaimer_rendered']
  );
});

test('phase650: runner executes llm_gate between product readiness and segment', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'tools/run_stg_notification_e2e_checklist.js'), 'utf8');
  const readinessCall = "runScenario(ctx, 'product_readiness_gate'";
  const llmGateCall = "runScenario(ctx, 'llm_gate'";
  const segmentCall = "runScenario(ctx, 'segment'";
  assert.ok(src.indexOf(readinessCall) < src.indexOf(llmGateCall), 'product readiness must run before llm_gate');
  assert.ok(src.indexOf(llmGateCall) < src.indexOf(segmentCall), 'llm_gate must run before segment');
});
