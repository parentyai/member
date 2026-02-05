'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const gate = require('../../scripts/phase22_kpi_gate');

function params(overrides) {
  return Object.assign({
    minTotalSent: 2,
    minPerVariantSent: 0,
    minTotalClick: 0,
    minDeltaCtr: 0
  }, overrides || {});
}

test('phase22 t03: PASS when totals meet thresholds', () => {
  const kpi = { sentA: 1, sentB: 1, clickA: 0, clickB: 0, ctrA: 0, ctrB: 0, deltaCTR: 0 };
  const result = gate.evaluateKpi(kpi, params());
  assert.equal(result.ok, true);
  assert.equal(result.reasons.length, 0);
});

test('phase22 t03: FAIL when totalSent insufficient', () => {
  const kpi = { sentA: 1, sentB: 0, clickA: 0, clickB: 0, ctrA: 0, ctrB: 0, deltaCTR: 0 };
  const result = gate.evaluateKpi(kpi, params({ minTotalSent: 2 }));
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('total_sent_lt_min'));
});

test('phase22 t03: FAIL when deltaCTR below threshold', () => {
  const kpi = { sentA: 2, sentB: 2, clickA: 1, clickB: 1, ctrA: 0.5, ctrB: 0.5, deltaCTR: 0 };
  const result = gate.evaluateKpi(kpi, params({ minDeltaCtr: 0.1 }));
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('delta_ctr_lt_min'));
});

test('phase22 t03: FAIL when required key missing', () => {
  const kpi = { sentA: 1, sentB: 1, clickA: 0, ctrA: 0, ctrB: 0, deltaCTR: 0 };
  const result = gate.evaluateKpi(kpi, params());
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((reason) => reason.startsWith('missing:')));
});

test('phase22 t03: FAIL on JSON parse error', () => {
  const parsed = gate.safeParseJson('{invalid');
  assert.equal(parsed.value, null);
  assert.ok(parsed.error);
});

test('phase22 t03: stdin read error yields env error code', async () => {
  const args = {};
  await assert.rejects(async () => {
    await gate.readInputText(args, { readStdin: async () => { throw new Error('boom'); } });
  }, (err) => {
    assert.equal(err.code, 'STDIN_READ_ERROR');
    return true;
  });
});
