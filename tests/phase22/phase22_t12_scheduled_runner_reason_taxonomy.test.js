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

test('phase22 t12: INVALID_ARGS when required args missing', async () => {
  const result = await runner.runScheduled(['--track-base-url', 'https://track']);
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.result, 'FAIL');
  assert.equal(result.output.reasonCode, 'INVALID_ARGS');
  assert.equal(result.output.stage, 'parse_args');
  assert.ok(result.output.subReason && result.output.subReason.includes('missing:'));
});

test('phase22 t12: SUBPROCESS_EXIT_NONZERO when kpi+gate present', async () => {
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
        kpi: { sentA: 1, sentB: 1, clickA: 0, clickB: 0, ctrA: 0, ctrB: 0, deltaCTR: 0 },
        gate: { ok: false, reasons: ['min-total-sent'] },
        result: 'FAIL'
      }
    })
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.reasonCode, 'SUBPROCESS_EXIT_NONZERO');
  assert.equal(result.output.stage, 'kpi_gate');
  assert.ok(result.output.subReason && result.output.subReason.includes('exitCode=1'));
});

test('phase22 t12: RUNTIME_ERROR when runAndGate throws', async () => {
  const deps = {
    runAndGate: () => { throw new Error('boom'); }
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.reasonCode, 'RUNTIME_ERROR');
  assert.equal(result.output.stage, 'run_and_gate');
  assert.ok(result.output.subReason && result.output.subReason.includes('boom'));
});
