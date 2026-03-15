'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  maskConversationReviewText
} = require('../../src/domain/qualityPatrol/transcriptMasking/maskConversationReviewText');
const {
  regionPrompt,
  regionInvalid
} = require('../../src/domain/regionLineMessages');
const {
  TEXT_LENGTH_CAPS,
  buildLineUserKey,
  buildMaskedConversationReviewSnapshot
} = require('../../src/domain/qualityPatrol/transcriptMasking/buildMaskedConversationReviewSnapshot');

test('phase845: transcript masking removes direct pii markers and applies length caps', () => {
  const masked = maskConversationReviewText({
    text: '連絡先は foo@example.com と https://example.com と 090-1234-5678 と 123-4567 と 1234567890 です。相談内容の要約も残したいので、この説明文を少し長めに続けます。',
    maxLength: 60
  });

  assert.equal(masked.available, true);
  assert.equal(masked.truncated, true);
  assert.equal(masked.text.includes('foo@example.com'), false);
  assert.equal(masked.text.includes('https://example.com'), false);
  assert.equal(masked.text.includes('090-1234-5678'), false);
  assert.equal(masked.text.includes('123-4567'), false);
  assert.equal(masked.text.includes('1234567890'), false);
  assert.match(masked.text, /\[email\]/);
  assert.match(masked.text, /\[url\]/);
  assert.match(masked.text, /\[phone\]/);
  assert.match(masked.text, /\[postal\]/);
  assert.match(masked.text, /\[number\]/);
  assert.equal(masked.text.length <= 60, true);
});

test('phase845: masked conversation snapshot stores hashed user key and structured prior context summary only', () => {
  const snapshot = buildMaskedConversationReviewSnapshot({
    lineUserId: 'U_PHASE845_USER_123',
    traceId: 'trace_phase845_snapshot',
    routeKind: 'canonical',
    domainIntent: 'housing',
    strategy: 'grounded_answer',
    selectedCandidateKind: 'city_pack_candidate',
    fallbackTemplateKind: 'answer_first',
    replyTemplateFingerprint: 'fp_phase845',
    priorContextUsed: true,
    followupResolvedFromHistory: true,
    knowledgeCandidateUsed: true,
    readinessDecision: 'allow',
    genericFallbackSlice: 'housing',
    userMessageText: '更新料はありますか？',
    assistantReplyText: 'あります。まずは契約書の該当条項を確認しましょう。',
    contextResumeDomain: 'housing',
    followupIntent: 'next_step',
    recentUserGoal: '更新手続きを進めたい',
    contextSnapshot: {
      phase: 'arrival',
      topOpenTasks: [{ title: '契約更新', status: 'todo' }]
    }
  });

  assert.equal(snapshot.lineUserKey, buildLineUserKey('U_PHASE845_USER_123'));
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'lineUserId'), false);
  assert.equal(snapshot.userMessageAvailable, true);
  assert.equal(snapshot.assistantReplyAvailable, true);
  assert.equal(snapshot.priorContextSummaryAvailable, true);
  assert.match(snapshot.priorContextSummaryMasked, /resume_domain:housing/);
  assert.match(snapshot.priorContextSummaryMasked, /journey_phase:arrival/);
  assert.match(snapshot.priorContextSummaryMasked, /open_tasks:契約更新\(todo\)/);
  assert.equal(snapshot.userMessageMasked.length <= TEXT_LENGTH_CAPS.userMessage, true);
  assert.equal(snapshot.assistantReplyMasked.length <= TEXT_LENGTH_CAPS.assistantReply, true);
  assert.equal(snapshot.priorContextSummaryMasked.length <= TEXT_LENGTH_CAPS.priorContextSummary, true);
  assert.equal(snapshot.snapshotInputDiagnostics.assistantReplyPresent, true);
  assert.equal(snapshot.snapshotInputDiagnostics.assistantReplyLength > 0, true);
  assert.equal(snapshot.snapshotInputDiagnostics.sanitizedReplyLength > 0, true);
  assert.equal(snapshot.snapshotInputDiagnostics.snapshotBuildAttempted, true);
  assert.equal(snapshot.snapshotInputDiagnostics.snapshotBuildSkippedReason, null);
});

test('phase845: masked conversation snapshot input diagnostics classify region fallback and empty sanitized reply candidates', () => {
  const regionPromptSnapshot = buildMaskedConversationReviewSnapshot({
    lineUserId: 'U_PHASE845_REGION_PROMPT',
    assistantReplyText: regionPrompt()
  });
  const regionInvalidSnapshot = buildMaskedConversationReviewSnapshot({
    lineUserId: 'U_PHASE845_REGION_INVALID',
    assistantReplyText: regionInvalid()
  });
  const missingReplySnapshot = buildMaskedConversationReviewSnapshot({
    lineUserId: 'U_PHASE845_REPLY_MISSING',
    assistantReplyText: '   '
  });

  assert.equal(regionPromptSnapshot.snapshotInputDiagnostics.snapshotBuildSkippedReason, 'region_prompt_fallback');
  assert.equal(regionInvalidSnapshot.snapshotInputDiagnostics.snapshotBuildSkippedReason, 'region_prompt_fallback');
  assert.equal(missingReplySnapshot.snapshotInputDiagnostics.snapshotBuildSkippedReason, 'assistant_reply_missing');
});
