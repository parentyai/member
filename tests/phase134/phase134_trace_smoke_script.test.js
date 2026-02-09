'use strict';

const assert = require('assert');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { readFileSync } = require('fs');
const { test } = require('node:test');

function runNode(args, env) {
  return spawnSync(process.execPath, args, {
    env: Object.assign({}, process.env, env || {}),
    encoding: 'utf8'
  });
}

test('phase134: run_trace_smoke.js completes with zero side effects and outputs trace bundle shape', async () => {
  const evidencePath = path.join(os.tmpdir(), `trace_smoke_evidence_${Date.now()}.md`);
  const result = runNode(['tools/run_trace_smoke.js'], {
    TRACE_SMOKE_MODE: 'stub',
    TRACE_SMOKE_EVIDENCE_PATH: evidencePath,
    TRACE_SMOKE_WRITE_EVIDENCE: '1',
    LINE_CHANNEL_ACCESS_TOKEN: '' // if push is called, it would throw
  });

  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  const lines = (result.stdout || '').trim().split('\n').filter(Boolean);
  const last = lines[lines.length - 1] || '';
  const json = JSON.parse(last);
  assert.strictEqual(json.ok, true);
  assert.ok(typeof json.traceId === 'string' && json.traceId.length > 0);
  assert.ok(json.counts);
  assert.ok(typeof json.counts.audits === 'number');
  assert.ok(typeof json.counts.decisions === 'number');
  assert.ok(typeof json.counts.timeline === 'number');
  assert.ok(Array.isArray(json.sample.auditActions));
  assert.ok(Array.isArray(json.sample.timelineActions));
  assert.ok(json.sample.auditActions.includes('ops_console.view'));
  assert.ok(json.sample.auditActions.includes('ops_decision.submit'));
  assert.ok(json.sample.timelineActions.includes('EXECUTE'));

  const evidence = readFileSync(evidencePath, 'utf8');
  assert.ok(evidence.includes('# TRACE_SMOKE_EVIDENCE'));
  assert.ok(evidence.includes(`traceId: ${json.traceId}`));
});

test('phase134: run_trace_smoke.js exits non-zero on failure', async () => {
  const result = runNode(['tools/run_trace_smoke.js'], {
    TRACE_SMOKE_MODE: 'stub',
    TRACE_SMOKE_NO_START_SERVER: '1'
  });
  assert.notStrictEqual(result.status, 0);
});
