'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { CONVERSATION_STATES } = require('../../src/domain/llm/conversation/conversationState');
const { CONVERSATION_MOVES, resolveConversationMove } = require('../../src/domain/llm/conversation/conversationMoves');

test('phase717: move resolver maps state to expected move', () => {
  assert.equal(resolveConversationMove({ state: CONVERSATION_STATES.BLOCKED }), CONVERSATION_MOVES.UNBLOCK);
  assert.equal(resolveConversationMove({ state: CONVERSATION_STATES.CLARIFY }), CONVERSATION_MOVES.NARROW);
  assert.equal(resolveConversationMove({ state: CONVERSATION_STATES.CLOSE }), CONVERSATION_MOVES.HANDOFF);
});

test('phase717: plan/execute move rules prefer prioritize/chunk/validate', () => {
  const prioritize = resolveConversationMove({
    state: CONVERSATION_STATES.PLAN,
    analysis: { nextActions: ['a', 'b', 'c'] },
    question: '進め方を教えて'
  });
  assert.equal(prioritize, CONVERSATION_MOVES.PRIORITIZE);

  const execute = resolveConversationMove({
    state: CONVERSATION_STATES.EXECUTE,
    analysis: { nextActions: ['a'] },
    question: '完了した'
  });
  assert.equal(execute, CONVERSATION_MOVES.VALIDATE);
});
