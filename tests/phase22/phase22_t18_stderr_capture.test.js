'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const runner = require('../../scripts/phase22_scheduled_runner');

function baseArgs() {
  return [
    '--track-base-url', 'https://track',
    '--linkRegistryId', 'lr1',
    '--ctaA', 'openA',
    '--ctaB', 'openB',
    '--from', '2026-02-05T00:00:00Z',
    '--to', '2026-02-06T00:00:00Z',
    '--runs', '2'
  ];
}

function kpiNullResult(stderr) {
  return {
    exitCode: 1,
    stderr,
    output: {
      utc: '2026-02-05T00:00:00Z',
      inputs: {
        trackBaseUrl: 'https://track',
        linkRegistryId: 'lr1',
        ctaA: 'openA',
        ctaB: 'openB',
        from: '2026-02-05T00:00:00Z',
        to: '2026-02-06T00:00:00Z',
        runs: '2'
      },
      kpi: null,
      gate: null,
      result: 'FAIL'
    }
  };
}

test('phase22 t18: stderr is captured on exitCode!=0', async () => {
  const deps = {
    runAndGate: () => kpiNullResult('boom')
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.output.reasonCode, 'KPI_NULL');
  assert.equal(result.output.stderrHead, 'boom');
  assert.equal(result.output.stderrCapture, 'captured');
  assert.ok(result.output.stderrBytes > 0);
  assert.notEqual(result.output.errorSignature, 'STDERR_EMPTY');
});

test('phase22 t18: empty stderr yields zero bytes and capture=empty', async () => {
  const deps = {
    runAndGate: () => kpiNullResult(''),
    captureSnapshotStderr: () => ({ stderrHead: '', stderrBytes: 0, stderrCapture: 'empty' })
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.output.reasonCode, 'KPI_NULL');
  assert.equal(result.output.stderrBytes, 0);
  assert.equal(result.output.stderrCapture, 'empty');
  assert.equal(result.output.errorSignature, 'STDERR_ZERO_BYTES');
});

test('phase22 t18: spawn error yields SPAWN_ERROR signature', async () => {
  const deps = {
    runAndGate: () => kpiNullResult(undefined),
    captureSnapshotStderr: () => ({
      stderrHead: '',
      stderrBytes: 0,
      stderrCapture: 'not_available',
      errorSignature: 'SPAWN_ERROR',
      subReason: 'ENOENT'
    })
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.output.reasonCode, 'KPI_NULL');
  assert.equal(result.output.errorSignature, 'SPAWN_ERROR');
  assert.equal(result.output.failure_class, 'IMPL');
});
