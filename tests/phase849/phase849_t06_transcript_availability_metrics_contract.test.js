'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildPatrolKpis } = require('../../src/domain/qualityPatrol/buildPatrolKpis');
const { evaluate, buildReviewUnit } = require('./phase849_helpers');

test('phase849: transcript availability metrics derive from review unit availability fields', () => {
  const full = buildReviewUnit({
    reviewUnitId: 'review_unit_phase849_availability_full',
    slice: 'follow-up',
    priorContextSummary: { text: '前回の相談', available: true }
  });
  const partial = buildReviewUnit({
    reviewUnitId: 'review_unit_phase849_availability_partial',
    slice: 'other',
    assistantReply: { text: '', available: false }
  });
  const evaluations = [evaluate({ reviewUnitId: full.reviewUnitId, slice: full.slice, priorContextSummary: full.priorContextSummary }).evaluation, evaluate({ reviewUnitId: partial.reviewUnitId, assistantReply: partial.assistantReply }).evaluation];

  const result = buildPatrolKpis({
    reviewUnits: [full, partial],
    evaluations
  });

  assert.equal(result.metrics.userMessageAvailableRate.value, 1);
  assert.equal(result.metrics.assistantReplyAvailableRate.value, 0.5);
  assert.equal(result.metrics.priorContextSummaryAvailableRate.sampleCount, 1);
  assert.equal(result.metrics.priorContextSummaryAvailableRate.value, 1);
  assert.equal(result.metrics.transcriptAvailability.sampleCount, 5);
});
