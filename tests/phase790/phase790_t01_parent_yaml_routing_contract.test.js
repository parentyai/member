'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  INTENT_TYPE_ENUM,
  ANSWER_MODE_ENUM,
  LIFECYCLE_STAGE_ENUM,
  REQUIRED_CORE_FACTS,
  evaluateParentYamlRoutingInvariant
} = require('../../src/domain/llm/policy/parentYamlRoutingContract');

test('phase790: parent YAML routing adapter resolves contract enums for follow-up domain flow', () => {
  const routing = evaluateParentYamlRoutingInvariant({
    domainIntent: 'ssn',
    followupIntent: 'docs_required',
    routerMode: 'question',
    strategy: 'domain_concierge',
    contextSnapshot: { phase: 'arrival' }
  });

  assert.equal(INTENT_TYPE_ENUM.includes(routing.intentType), true);
  assert.equal(ANSWER_MODE_ENUM.includes(routing.answerMode), true);
  assert.equal(LIFECYCLE_STAGE_ENUM.includes(routing.lifecycleStage), true);
  assert.equal(routing.intentType, 'DOCUMENTS_REQUIRED');
  assert.equal(routing.answerMode, 'ACTION_PLAN');
  assert.equal(routing.chapter, 'N');
  assert.equal(routing.invariantStatus, 'ok');
  assert.deepEqual(routing.invariantErrors, []);
});

test('phase790: parent YAML routing adapter returns stable defaults for general conversation', () => {
  const routing = evaluateParentYamlRoutingInvariant({
    domainIntent: 'general',
    routerMode: 'casual',
    strategy: 'casual',
    contextSnapshot: { phase: 'pre' }
  });

  assert.equal(routing.intentType, 'GENERAL_OVERVIEW');
  assert.equal(routing.answerMode, 'EXPLANATION');
  assert.equal(routing.lifecycleStage, 'PRE_DEPARTURE');
  assert.equal(routing.chapter, 'A');
  assert.equal(routing.invariantStatus, 'ok');
});

test('phase790: required core facts list stays aligned with parent YAML contract', () => {
  assert.deepEqual(REQUIRED_CORE_FACTS, [
    'assignment_type',
    'planned_entry_date',
    'assignment_start_date',
    'destination_state',
    'destination_city',
    'primary_visa_class',
    'dependents_present',
    'housing_stage',
    'school_needed_flag',
    'spouse_work_intent'
  ]);
});
