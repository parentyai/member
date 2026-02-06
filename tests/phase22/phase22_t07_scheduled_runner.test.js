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

function baseOutput() {
  return {
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
    gate: { ok: true, reasons: [] },
    result: 'PASS'
  };
}

test('phase22 t07: PASS returns exitCode 0 and no record on dry-run', async () => {
  let recordCalls = 0;
  const deps = {
    runAndGate: () => ({ exitCode: 0, output: baseOutput() }),
    runGateAndRecord: async () => { recordCalls += 1; return { exitCode: 0, output: baseOutput() }; },
    nowIso: () => '2026-02-05T00:00:00Z'
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.exitCode, 0);
  assert.equal(result.output.result, 'PASS');
  assert.equal(recordCalls, 0);
});

test('phase22 t07: write=1 calls record after pass', async () => {
  let recordCalls = 0;
  const deps = {
    runAndGate: () => ({ exitCode: 0, output: baseOutput() }),
    runGateAndRecord: async () => { recordCalls += 1; return { exitCode: 0, output: baseOutput() }; },
    nowIso: () => '2026-02-05T00:00:00Z'
  };
  const result = await runner.runScheduled(baseArgs().concat(['--write', '1']), deps);
  assert.equal(result.exitCode, 0);
  assert.equal(recordCalls, 1);
});

test('phase22 t07: FAIL bubbles exitCode 1', async () => {
  const deps = {
    runAndGate: () => ({ exitCode: 1, output: Object.assign({}, baseOutput(), { result: 'FAIL' }) })
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.result, 'FAIL');
});

test('phase22 t07: VERIFY_ENV_ERROR bubbles exitCode 2', async () => {
  const deps = {
    runAndGate: () => ({ exitCode: 2, output: Object.assign({}, baseOutput(), { result: 'VERIFY_ENV_ERROR' }) })
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.exitCode, 2);
  assert.equal(result.output.result, 'VERIFY_ENV_ERROR');
});

test('phase22 t07: runner exception returns exitCode 1', async () => {
  const deps = {
    runAndGate: () => { throw new Error('boom'); },
    nowIso: () => '2026-02-05T00:00:00Z'
  };
  const result = await runner.runScheduled(baseArgs(), deps);
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.result, 'FAIL');
});
