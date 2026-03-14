'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationPacket } = require('../../src/domain/llm/orchestrator/buildConversationPacket');

test('phase832: conversation packet records when follow-up resolution comes from prior context', () => {
  const recentActionRows = [{
    createdAt: '2026-03-13T10:00:00.000Z',
    domainIntent: 'housing',
    followupIntent: 'next_step',
    committedNextActions: ['住居候補を3件比較する'],
    committedFollowupQuestion: '内見はいつ進めますか？',
    recentUserGoal: '住まいを決めたい'
  }];

  const positive = buildConversationPacket({
    lineUserId: 'u1',
    messageText: 'それで',
    recentActionRows,
    contextSnapshot: { blockedTask: { key: 'housing_lease' } },
    routerMode: 'question',
    llmFlags: { llmConciergeEnabled: true }
  });
  assert.equal(positive.priorContextUsed, true);
  assert.equal(positive.followupResolvedFromHistory, true);
  assert.equal(positive.continuationReason, 'history_followup_carry');
  assert.equal(positive.genericFallbackSlice, 'followup');

  const negative = buildConversationPacket({
    lineUserId: 'u1',
    messageText: 'それってどのタイミングでやるのがいいですか？',
    recentActionRows,
    contextSnapshot: { blockedTask: { key: 'housing_lease' } },
    routerMode: 'question',
    llmFlags: { llmConciergeEnabled: true }
  });
  assert.equal(negative.priorContextUsed, true);
  assert.equal(negative.followupResolvedFromHistory, false);
  assert.equal(negative.genericFallbackSlice, 'followup');
});
