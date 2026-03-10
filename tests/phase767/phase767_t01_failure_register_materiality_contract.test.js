'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeEntries,
  isMaterialFailureEntry,
  buildSnapshot
} = require('../../tools/llm_quality/register_top_failures');

test('phase767: materiality filter drops zero-value japanese/line failure rows', () => {
  const entries = normalizeEntries({
    top_10_quality_failures: [],
    top_10_loop_cases: [],
    top_10_context_loss_cases: [],
    top_10_japanese_service_failures: [
      { signal: 'legacyTemplateHitRate', value: 0 },
      { signal: 'defaultCasualRate', value: 0.009 },
      { signal: 'conciseModeAppliedRate', value: 0.05 },
      { signal: 'followupQuestionIncludedRate', value: 0.9, available: false }
    ],
    top_10_line_fit_failures: [
      { signal: 'retrieveNeededRate', value: 0 },
      { signal: 'avgActionCountOverBudget', value: 0.004 },
      { signal: 'defaultCasualRate', value: 0.02 }
    ]
  }, 10);

  assert.equal(entries.some((row) => row.signal === 'legacyTemplateHitRate'), false);
  assert.equal(entries.some((row) => row.signal === 'defaultCasualRate' && row.metric === 'japanese_service'), false);
  assert.equal(entries.some((row) => row.signal === 'retrieveNeededRate'), false);
  assert.equal(entries.some((row) => row.signal === 'avgActionCountOverBudget'), false);
  assert.equal(entries.some((row) => row.signal === 'followupQuestionIncludedRate'), false);
  assert.equal(entries.some((row) => row.signal === 'conciseModeAppliedRate' && row.metric === 'japanese_service'), true);
  assert.equal(entries.some((row) => row.signal === 'defaultCasualRate' && row.metric === 'line_fit'), true);
});

test('phase767: buildSnapshot keeps zero-entry snapshot when no material failures exist', () => {
  const snapshot = buildSnapshot({
    report: {
      generatedAt: '2026-03-10T05:00:00.000Z',
      overall_quality_score: 93.5,
      hard_gate_failures: [],
      top_10_quality_failures: [],
      top_10_loop_cases: [],
      top_10_context_loss_cases: [],
      top_10_japanese_service_failures: [{ signal: 'defaultCasualRate', value: 0 }],
      top_10_line_fit_failures: [{ signal: 'retrieveNeededRate', value: 0 }]
    },
    gate: { failures: [] },
    limit: 10
  });

  assert.equal(snapshot.entryCount, 0);
  assert.equal(Array.isArray(snapshot.entries), true);
  assert.equal(snapshot.entries.length, 0);
});

test('phase767: quality_failure and loop/context rows are always material when non-empty', () => {
  assert.equal(isMaterialFailureEntry({
    category: 'quality_failure',
    signal: 'slice_fail:short_followup'
  }), true);
  assert.equal(isMaterialFailureEntry({
    category: 'loop_case',
    signal: 'routerReason:default_casual',
    count: 2
  }), true);
  assert.equal(isMaterialFailureEntry({
    category: 'context_loss_case',
    signal: 'followup:none',
    count: 1
  }), true);
});
