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

test('phase22 t16: invalid_rapt => ENV classification', async () => {
  const deps = {
    runAndGate: () => kpiNullResult('invalid_rapt: reauth required'),
    captureSnapshotStderr: () => ({ stderrHead: 'invalid_rapt: reauth required', stderrBytes: 30, stderrCapture: 'captured' })
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.output.reasonCode, 'KPI_NULL');
  assert.equal(result.output.stage, 'kpi_snapshot');
  assert.equal(result.output.failure_class, 'ENV');
  assert.equal(result.output.errorSignature, 'ADC_REAUTH_REQUIRED');
  assert.ok(result.output.stderrHead.includes('invalid_rapt'));
});

test('phase22 t16: firebase-admin missing => ENV classification', async () => {
  const deps = {
    runAndGate: () => kpiNullResult("Cannot find module 'firebase-admin'"),
    captureSnapshotStderr: () => ({ stderrHead: "Cannot find module 'firebase-admin'", stderrBytes: 36, stderrCapture: 'captured' })
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.output.failure_class, 'ENV');
  assert.equal(result.output.errorSignature, 'FIREBASE_ADMIN_MISSING');
});

test('phase22 t16: generic stderr => IMPL classification', async () => {
  const deps = {
    runAndGate: () => kpiNullResult('boom'),
    captureSnapshotStderr: () => ({ stderrHead: 'boom', stderrBytes: 4, stderrCapture: 'captured' })
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.output.failure_class, 'IMPL');
  assert.equal(result.output.errorSignature, 'KPI_NULL_EXIT_1');
});

test('phase22 t16: empty stderr => UNKNOWN classification', async () => {
  const deps = {
    runAndGate: () => kpiNullResult(''),
    captureSnapshotStderr: () => ({ stderrHead: '', stderrBytes: 0, stderrCapture: 'empty' })
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.output.failure_class, 'IMPL');
  assert.equal(result.output.errorSignature, 'STDERR_ZERO_BYTES');
  assert.equal(result.output.stderrHead, '');
});
