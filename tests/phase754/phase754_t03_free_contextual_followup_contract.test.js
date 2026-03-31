'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveFreeContextualFollowup } = require('../../src/domain/llm/conversation/freeContextualFollowup');

test('phase754: free contextual follow-up emits concise direct answer when recent domain context exists', () => {
  const resolved = resolveFreeContextualFollowup({
    messageText: '必要書類は？',
    messageDomainIntent: 'general',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'school'
      }
    ]
  });

  assert.ok(resolved);
  assert.equal(resolved.contextResumeDomain, 'school');
  assert.equal(resolved.followupIntent, 'docs_required');
  assert.equal(typeof resolved.replyText, 'string');
  assert.equal(resolved.replyText.length > 0, true);
  assert.equal(resolved.replyText.includes('FAQ候補'), false);
  assert.equal(resolved.replyText.includes('根拠キー'), false);
  assert.equal(resolved.qualityMeta.directAnswerApplied, true);
  assert.equal(resolved.qualityMeta.conciseModeApplied, true);
  assert.equal(resolved.qualityMeta.contextCarryScore >= 0.8, true);
  assert.equal(typeof resolved.procedurePacket, 'object');
  assert.equal(resolved.procedurePacket.replyObjective, 'clarify_blocker');
  assert.equal(Array.isArray(resolved.procedurePacket.overallFlow), true);
  assert.equal(resolved.procedurePacket.overallFlow.length >= 3, true);
  assert.equal(Array.isArray(resolved.nextSteps), true);
  assert.equal(resolved.nextSteps.length >= 1, true);
  assert.equal(Array.isArray(resolved.procedurePacket.officialCheckTargets), true);
  assert.equal(resolved.procedurePacket.officialCheckTargets.length >= 1, true);
});

test('phase754: free contextual follow-up stays disabled without prior domain context', () => {
  const resolved = resolveFreeContextualFollowup({
    messageText: '必要書類は？',
    messageDomainIntent: 'general',
    recentActionRows: []
  });

  assert.equal(resolved, null);
});
