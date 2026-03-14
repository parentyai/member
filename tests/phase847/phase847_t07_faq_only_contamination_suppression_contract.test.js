'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationReviewUnits } = require('../../src/domain/qualityPatrol/transcript/buildConversationReviewUnits');

test('phase847: faq-only rows without snapshot/action anchors do not create standalone review units', () => {
  const units = buildConversationReviewUnits({
    snapshots: [],
    llmActionLogs: [{
      id: 'action_anchor_1',
      traceId: 'trace_anchor_1',
      lineUserId: 'U_PHASE847_FAQ_ANCHOR',
      strategyReason: 'anchor_exists',
      createdAt: '2026-03-14T12:00:00.000Z'
    }],
    faqAnswerLogs: [
      {
        id: 'faq_no_trace',
        traceId: null,
        matchedArticleIds: ['faq_null'],
        createdAt: '2026-03-14T12:00:01.000Z'
      },
      {
        id: 'faq_unmatched_trace',
        traceId: 'trace_unmatched',
        matchedArticleIds: ['faq_unmatched'],
        createdAt: '2026-03-14T12:00:02.000Z'
      },
      {
        id: 'faq_matched_trace',
        traceId: 'trace_anchor_1',
        matchedArticleIds: ['faq_matched'],
        createdAt: '2026-03-14T12:00:03.000Z'
      }
    ],
    traceBundles: {
      trace_anchor_1: {
        ok: true,
        traceId: 'trace_anchor_1',
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
  assert.equal(unit.traceId, 'trace_anchor_1');
  assert.equal(unit.anchorKind, 'action_only');
  assert.equal(unit.evidenceJoinStatus.faq, 'joined');
  const faqRefs = unit.evidenceRefs.filter((row) => row.source === 'faq_answer_logs');
  assert.equal(faqRefs.length, 1);
  assert.equal(faqRefs[0].refId, 'faq_matched_trace');
});
