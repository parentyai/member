'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');

const pkg = require('../../package.json');

test('phase783: test:trace-smoke script enforces read-only evidence mode', () => {
  const script = String(pkg.scripts && pkg.scripts['test:trace-smoke'] ? pkg.scripts['test:trace-smoke'] : '');
  assert.match(script, /TRACE_SMOKE_WRITE_EVIDENCE=0/);
  assert.match(script, /TRACE_SMOKE_EVIDENCE_PATH=\/tmp\/trace_smoke_evidence\.md/);
});

test('phase783: run_trace_smoke default result does not claim tracked docs evidence output', () => {
  const result = spawnSync(process.execPath, ['tools/run_trace_smoke.js'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      TRACE_SMOKE_MODE: 'stub',
      TRACE_SMOKE_WRITE_EVIDENCE: '',
      LINE_CHANNEL_ACCESS_TOKEN: ''
    })
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const lines = String(result.stdout || '').trim().split('\n').filter(Boolean);
  const last = lines[lines.length - 1] || '{}';
  const payload = JSON.parse(last);
  assert.equal(payload.ok, true);
  assert.equal(payload.evidencePath, null);
});
