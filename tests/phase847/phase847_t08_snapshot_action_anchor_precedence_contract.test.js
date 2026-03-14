'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationReviewUnits } = require('../../src/domain/qualityPatrol/transcript/buildConversationReviewUnits');

test('phase847: snapshot/action anchors take precedence while faq evidence stays auxiliary', () => {
  const units = buildConversationReviewUnits({
    snapshots: [{
      id: 'snapshot_anchor_1',
      lineUserKey: 'userkey_phase847_anchor_precedence',
      traceId: 'trace_anchor_precedence',
      userMessageMasked: '申請の必要書類は何ですか？',
      assistantReplyMasked: 'まず在留カードと住民票をそろえてください。',
      priorContextSummaryMasked: '',
      userMessageAvailable: true,
      assistantReplyAvailable: true,
      priorContextSummaryAvailable: false,
      createdAt: '2026-03-14T13:00:00.000Z'
    }],
    llmActionLogs: [{
      id: 'action_anchor_1',
      traceId: 'trace_anchor_precedence',
      lineUserId: 'U_PHASE847_ANCHOR_PRECEDENCE',
      strategyReason: 'snapshot_action_anchor',
      savedFaqCandidateAvailable: true,
      createdAt: '2026-03-14T13:00:01.000Z'
    }],
    faqAnswerLogs: [{
      id: 'faq_aux_1',
      traceId: 'trace_anchor_precedence',
      matchedArticleIds: ['faq_anchor_precedence'],
      createdAt: '2026-03-14T13:00:02.000Z'
    }],
    traceBundles: {
      trace_anchor_precedence: {
        ok: true,
        traceId: 'trace_anchor_precedence',
        traceJoinSummary: {
          completeness: 1,
          joinedDomains: ['llmActions', 'faq'],
          missingDomains: [],
          criticalMissingDomains: []
        }
      }
    }
  });

  assert.equal(units.length, 1);
  const unit = units[0];
  assert.equal(unit.anchorKind, 'snapshot_action');
  assert.equal(unit.lineUserKey, 'userkey_phase847_anchor_precedence');
  assert.equal(unit.userMessage.available, true);
  assert.equal(unit.assistantReply.available, true);
  assert.equal(unit.evidenceJoinStatus.actionLog, 'joined');
  assert.equal(unit.evidenceJoinStatus.faq, 'joined');
  assert.ok(unit.evidenceRefs.some((row) => row.source === 'conversation_review_snapshots'));
  assert.ok(unit.evidenceRefs.some((row) => row.source === 'llm_action_logs'));
  assert.ok(unit.evidenceRefs.some((row) => row.source === 'faq_answer_logs'));
});
