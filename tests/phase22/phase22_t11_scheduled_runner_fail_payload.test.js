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

test('phase22 t11: FAIL output includes reasonCode', async () => {
  const deps = {
    runAndGate: () => ({
      exitCode: 1,
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
    }),
    captureSnapshotStderr: () => ({ stderrHead: '', stderrBytes: 0, stderrCapture: 'empty' })
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.result, 'FAIL');
  assert.equal(result.output.reasonCode, 'KPI_NULL');
  assert.equal(result.output.stage, 'kpi_snapshot');
});
