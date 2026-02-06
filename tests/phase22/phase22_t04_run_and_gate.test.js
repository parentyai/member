'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const orchestrator = require('../../scripts/phase22_run_and_gate');

function baseArgs() {
  return {
    trackBaseUrl: 'https://track',
    linkRegistryId: 'lr1',
    ctaA: 'openA',
    ctaB: 'openB',
    from: '2026-02-05T00:00:00Z',
    to: '2026-02-06T00:00:00Z',
    runs: '2'
  };
}

function makeDeps(overrides) {
  const defaults = {
    runRunner: () => ({ status: 0, stdout: '', stderr: '' }),
    runSnapshot: () => ({ status: 0, stdout: JSON.stringify({ sentA: 1, sentB: 1, clickA: 0, clickB: 0, ctrA: 0, ctrB: 0, deltaCTR: 0 }), stderr: '' }),
    runGate: () => ({ status: 0, stdout: JSON.stringify({ ok: true, reasons: [] }), stderr: '' })
  };
  return Object.assign({}, defaults, overrides || {});
}

test('phase22 t04: PASS when gate exitCode=0', () => {
  const result = orchestrator.runOrchestrator(baseArgs(), makeDeps());
  assert.equal(result.exitCode, 0);
  assert.equal(result.output.result, 'PASS');
});

test('phase22 t04: FAIL when gate exitCode=1', () => {
  const deps = makeDeps({
    runGate: () => ({ status: 1, stdout: JSON.stringify({ ok: false, reasons: ['x'] }), stderr: '' })
  });
  const result = orchestrator.runOrchestrator(baseArgs(), deps);
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.result, 'FAIL');
});

test('phase22 t04: VERIFY_ENV_ERROR when gate exitCode=2', () => {
  const deps = makeDeps({
    runGate: () => ({ status: 2, stdout: JSON.stringify({ ok: false, reasons: ['env'] }), stderr: 'VERIFY_ENV_ERROR' })
  });
  const result = orchestrator.runOrchestrator(baseArgs(), deps);
  assert.equal(result.exitCode, 2);
  assert.equal(result.output.result, 'VERIFY_ENV_ERROR');
});

test('phase22 t04: snapshot throws => FAIL', () => {
  const deps = makeDeps({
    runSnapshot: () => { throw new Error('boom'); }
  });
  const result = orchestrator.runOrchestrator(baseArgs(), deps);
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.result, 'FAIL');
});

test('phase22 t04: runner throws => FAIL', () => {
  const deps = makeDeps({
    runRunner: () => { throw new Error('boom'); }
  });
  const result = orchestrator.runOrchestrator(baseArgs(), deps);
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.result, 'FAIL');
});
