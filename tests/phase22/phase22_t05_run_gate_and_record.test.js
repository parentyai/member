'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const wrapper = require('../../scripts/phase22_run_gate_and_record');

function baseOutput() {
  return {
    utc: '2026-02-05T00:00:00Z',
    inputs: {
      trackBaseUrl: 'https://track.example.com',
      linkRegistryId: 'lr1',
      ctaA: 'openA',
      ctaB: 'openB',
      from: '2026-02-05T00:00:00Z',
      to: '2026-02-06T00:00:00Z',
      runs: '2'
    },
    kpi: {
      sentA: 1,
      clickA: 0,
      ctrA: 0,
      sentB: 1,
      clickB: 0,
      ctrB: 0,
      deltaCTR: 0
    },
    gate: { ok: false, reasons: [] },
    result: 'FAIL'
  };
}

test('phase22 t05: no --write keeps exitCode and does not call repo', async () => {
  let called = 0;
  const deps = {
    runAndGate: () => ({ exitCode: 1, output: baseOutput() }),
    snapshotsRepo: { upsertSnapshot: async () => { called += 1; } },
    logger: { error: () => {} }
  };
  const result = await wrapper.runGateAndRecord(['--ctaA', 'openA'], deps);
  assert.equal(result.exitCode, 1);
  assert.equal(called, 0);
  assert.deepEqual(result.output.result, 'FAIL');
});

test('phase22 t05: --write 1 calls repo and keeps exitCode on error', async () => {
  let called = 0;
  const errors = [];
  const deps = {
    runAndGate: () => ({ exitCode: 1, output: baseOutput() }),
    snapshotsRepo: { upsertSnapshot: async () => { called += 1; throw new Error('fail'); } },
    logger: { error: (msg) => errors.push(msg) },
    parseUrlHost: () => 'track.example.com'
  };
  const result = await wrapper.runGateAndRecord(['--write', '1'], deps);
  assert.equal(result.exitCode, 1);
  assert.equal(called, 1);
  assert.ok(errors[0].includes('OBS phase22_record result=error'));
});
