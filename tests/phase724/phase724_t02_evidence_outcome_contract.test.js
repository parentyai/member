'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  resolveEvidenceNeed,
  resolveEvidenceOutcome,
  EVIDENCE_OUTCOME
} = require('../../src/domain/llm/conversation/evidenceOutcome');

test('phase724: mode->evidence need mapping is fixed', () => {
  assert.equal(resolveEvidenceNeed('A'), 'none');
  assert.equal(resolveEvidenceNeed('B'), 'required');
  assert.equal(resolveEvidenceNeed('C'), 'optional');
});

test('phase724: required evidence without URL becomes INSUFFICIENT', () => {
  const resolved = resolveEvidenceOutcome({
    mode: 'B',
    evidenceNeed: 'required',
    urlCount: 0,
    blockedReasons: [],
    injectionFindings: false
  });

  assert.equal(resolved.evidenceNeed, 'required');
  assert.equal(resolved.evidenceOutcome, EVIDENCE_OUTCOME.INSUFFICIENT);
});

test('phase724: blocking signals force BLOCKED regardless of URL count', () => {
  const resolved = resolveEvidenceOutcome({
    mode: 'B',
    evidenceNeed: 'required',
    urlCount: 2,
    blockedReasons: ['provider_error'],
    injectionFindings: false
  });

  assert.equal(resolved.evidenceOutcome, EVIDENCE_OUTCOME.BLOCKED);
});
