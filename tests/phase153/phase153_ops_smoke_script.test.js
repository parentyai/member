'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const { test } = require('node:test');

function runNode(args, env) {
  return spawnSync(process.execPath, args, {
    env: Object.assign({}, process.env, env || {}),
    encoding: 'utf8'
  });
}

test('phase153: run_ops_smoke.js completes with guarded execute and trace bundle coverage', async () => {
  const result = runNode(['tools/run_ops_smoke.js'], {
    OPS_SMOKE_MODE: 'stub',
    LINE_CHANNEL_ACCESS_TOKEN: '' // if push is called, it would throw
  });

  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  const lines = (result.stdout || '').trim().split('\n').filter(Boolean);
  const last = lines[lines.length - 1] || '';
  const json = JSON.parse(last);
  assert.strictEqual(json.ok, true);
  assert.ok(typeof json.traceId === 'string' && json.traceId.length > 0);
  assert.ok(json.counts);
  assert.ok(Array.isArray(json.sample.auditActions));
  assert.ok(json.sample.auditActions.includes('ops_console.view'));
  assert.ok(json.sample.auditActions.includes('notification_mitigation.suggest'));
  assert.ok(json.sample.auditActions.includes('ops_decision.submit'));
  assert.ok(json.sample.auditActions.includes('notification_mitigation.decision'));
  assert.ok(json.sample.auditActions.includes('ops_decision.execute'));
  assert.ok(json.execution);
  assert.strictEqual(json.execution.killSwitch, true);
  assert.strictEqual(json.execution.blocked, true);
});

