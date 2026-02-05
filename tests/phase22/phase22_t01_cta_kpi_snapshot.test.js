'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSnapshot } = require('../../scripts/phase22_cta_kpi_snapshot');

test('phase22 t01: CTR calculation and delta', () => {
  const stats = {
    sentCountA: 4,
    clickCountA: 2,
    sentCountB: 5,
    clickCountB: 1
  };
  const snapshot = buildSnapshot(stats, 'openA', 'openB', '2026-02-05T00:00:00Z');
  assert.equal(snapshot.ctaA, 'openA');
  assert.equal(snapshot.ctaB, 'openB');
  assert.equal(snapshot.sentA, 4);
  assert.equal(snapshot.clickA, 2);
  assert.equal(snapshot.sentB, 5);
  assert.equal(snapshot.clickB, 1);
  assert.equal(snapshot.ctrA, 0.5);
  assert.equal(snapshot.ctrB, 0.2);
  assert.equal(snapshot.deltaCTR, 0.3);
});

test('phase22 t01: zero division yields 0 CTR', () => {
  const stats = {
    sentCountA: 0,
    clickCountA: 3,
    sentCountB: 0,
    clickCountB: 0
  };
  const snapshot = buildSnapshot(stats, 'openA', 'openB', '2026-02-05T00:00:00Z');
  assert.equal(snapshot.ctrA, 0);
  assert.equal(snapshot.ctrB, 0);
  assert.equal(snapshot.deltaCTR, 0);
});

test('phase22 t01: JSON structure keys', () => {
  const stats = {
    sentCountA: 1,
    clickCountA: 0,
    sentCountB: 1,
    clickCountB: 1
  };
  const snapshot = buildSnapshot(stats, 'openA', 'openB', '2026-02-05T00:00:00Z');
  const keys = Object.keys(snapshot);
  const expected = ['utc', 'ctaA', 'ctaB', 'sentA', 'clickA', 'ctrA', 'sentB', 'clickB', 'ctrB', 'deltaCTR'];
  expected.forEach((key) => assert.ok(keys.includes(key)));
});
