'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/verify_llm_runtime.sh');

function runScript(statusPayload) {
  return spawnSync('bash', [SCRIPT_PATH], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      LLM_RUNTIME_STATUS_JSON: JSON.stringify(statusPayload || {})
    })
  });
}

test('phase718: verify_llm_runtime script passes only when strict runtime predicate is satisfied', () => {
  const result = runScript({
    ok: true,
    runtimeState: {
      envFlag: true,
      systemFlag: true,
      effectiveEnabled: true,
      blockingReason: null
    }
  });
  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout || '{}');
  assert.equal(json.ok, true);
  assert.equal(json.envFlag, true);
  assert.equal(json.systemFlag, true);
  assert.equal(json.effectiveEnabled, true);
  assert.equal(json.blockingReason, null);
});

test('phase718: verify_llm_runtime script fails when env/system/effective are not strict-true', () => {
  const result = runScript({
    ok: true,
    runtimeState: {
      envFlag: false,
      systemFlag: true,
      effectiveEnabled: false,
      blockingReason: null
    }
  });
  assert.notEqual(result.status, 0);
  const json = JSON.parse(result.stderr || '{}');
  assert.equal(json.ok, false);
  assert.equal(json.reason, 'runtime_guard_failed');
  assert.ok(Array.isArray(json.failedChecks));
  assert.ok(json.failedChecks.includes('env_flag_disabled'));
  assert.ok(json.failedChecks.includes('effective_disabled'));
});

test('phase718: verify_llm_runtime script fails when blockingReason exists', () => {
  const result = runScript({
    ok: true,
    runtimeState: {
      envFlag: true,
      systemFlag: true,
      effectiveEnabled: false,
      blockingReason: 'policy_block'
    }
  });
  assert.notEqual(result.status, 0);
  const json = JSON.parse(result.stderr || '{}');
  assert.equal(json.ok, false);
  assert.ok(json.failedChecks.includes('blocking_reason_present'));
});
