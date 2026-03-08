'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { computeSourceFreshnessScore } = require('../../src/v1/retrieval_and_verification/sourceReadinessMonitor');
const { detectContradiction } = require('../../src/v1/retrieval_and_verification/contradictionChecker');
const { countUnsupportedClaims } = require('../../src/v1/retrieval_and_verification/unsupportedClaimChecker');

test('phase760: source freshness monitor grades fresh and stale refs', () => {
  const now = new Date('2026-03-08T00:00:00.000Z').toISOString();
  const score = computeSourceFreshnessScore([
    { updatedAt: '2026-03-01T00:00:00.000Z' },
    { updatedAt: '2025-10-01T00:00:00.000Z' }
  ], now);
  assert.ok(score >= 0 && score <= 1);
});

test('phase760: contradiction and unsupported checks detect risk', () => {
  assert.equal(detectContradiction([{ contradicted: false }, { contradicted: true }]), true);
  assert.equal(countUnsupportedClaims([{ supported: true }, { supported: false }]), 1);
});
