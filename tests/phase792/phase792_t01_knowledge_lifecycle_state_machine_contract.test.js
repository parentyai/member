'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  deriveKnowledgeLifecycleState,
  resolveKnowledgeLifecycleBucket,
  assertKnowledgeLifecycleTransition,
  normalizeKnowledgeLifecycleState
} = require('../../src/domain/data/knowledgeLifecycleStateMachine');

test('phase792: deriveKnowledgeLifecycleState maps status fallback and explicit state', () => {
  assert.equal(deriveKnowledgeLifecycleState({ status: 'active' }), 'approved');
  assert.equal(deriveKnowledgeLifecycleState({ status: 'needs_review' }), 'candidate');
  assert.equal(deriveKnowledgeLifecycleState({ knowledgeLifecycleState: 'rejected', status: 'active' }), 'rejected');
  assert.equal(normalizeKnowledgeLifecycleState('deprecated'), 'deprecated');
  assert.equal(resolveKnowledgeLifecycleBucket('approved'), 'approved_knowledge');
  assert.equal(resolveKnowledgeLifecycleBucket('candidate'), 'candidate_knowledge');
});

test('phase792: transition guard blocks deprecated -> rejected', () => {
  assert.throws(() => {
    assertKnowledgeLifecycleTransition({
      fromState: 'deprecated',
      toState: 'rejected'
    });
  }, /KNOWLEDGE_LIFECYCLE_TRANSITION_BLOCKED|transition blocked/);
});
