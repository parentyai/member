'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  CONVERSATION_STATES,
  transitionState,
  resolveConversationState
} = require('../../src/domain/llm/conversation/conversationState');

test('phase717: state machine allows ENTRY->PLAN and ANY->BLOCKED', () => {
  const entryToPlan = transitionState(CONVERSATION_STATES.ENTRY, CONVERSATION_STATES.PLAN);
  assert.equal(entryToPlan.validTransition, true);
  assert.equal(entryToPlan.to, CONVERSATION_STATES.PLAN);

  const planToBlocked = transitionState(CONVERSATION_STATES.PLAN, CONVERSATION_STATES.BLOCKED);
  assert.equal(planToBlocked.validTransition, true);
  assert.equal(planToBlocked.to, CONVERSATION_STATES.BLOCKED);
});

test('phase717: state resolver chooses BLOCKED/CLARIFY/PLAN based on inputs', () => {
  const blocked = resolveConversationState({
    blockedReasons: ['external_instruction_detected'],
    analysis: { missing: [], nextActions: ['a'] },
    question: 'visa'
  });
  assert.equal(blocked.to, CONVERSATION_STATES.BLOCKED);

  const clarify = resolveConversationState({
    blockedReasons: [],
    analysis: { missing: ['不足があります'], nextActions: [] },
    question: 'どうすれば'
  });
  assert.equal(clarify.to, CONVERSATION_STATES.CLARIFY);

  const plan = resolveConversationState({
    blockedReasons: [],
    analysis: { missing: [], nextActions: ['書類確認'] },
    question: 'ビザ更新'
  });
  assert.equal(plan.to, CONVERSATION_STATES.PLAN);
});
