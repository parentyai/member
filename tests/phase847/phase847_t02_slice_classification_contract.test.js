'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { classifyConversationSlice } = require('../../src/domain/qualityPatrol/transcript/classifyConversationSlice');

test('phase847: generic fallback slice has highest priority', () => {
  const result = classifyConversationSlice({
    genericFallbackSlice: 'followup',
    priorContextUsed: false,
    followupResolvedFromHistory: false,
    cityPackUsedInAnswer: true
  });
  assert.equal(result.slice, 'follow-up');
  assert.equal(result.sliceReason, 'generic_fallback_slice');
});

test('phase847: follow-up signals outrank city and housing inference when generic fallback slice is absent', () => {
  const result = classifyConversationSlice({
    genericFallbackSlice: null,
    priorContextUsed: true,
    cityPackUsedInAnswer: true,
    strategyReason: 'housing_grounded_answer'
  });
  assert.equal(result.slice, 'follow-up');
  assert.equal(result.sliceReason, 'followup_context_signal');
});

test('phase847: city, housing, broad and other fall through deterministically', () => {
  assert.equal(classifyConversationSlice({
    strategyReason: 'explicit_city_grounded_answer',
    cityPackCandidateAvailable: true
  }).slice, 'city');
  assert.equal(classifyConversationSlice({
    domainIntent: 'housing',
    strategyReason: 'explicit_domain_grounded_answer'
  }).slice, 'housing');
  assert.equal(classifyConversationSlice({
    strategyReason: 'broad_question_domain_concierge',
    domainIntent: 'general'
  }).slice, 'broad');
  assert.equal(classifyConversationSlice({
    strategyReason: 'clarify_needed'
  }).slice, 'other');
});
