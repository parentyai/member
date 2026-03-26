'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  buildConversationReviewUnitsFromDesktopTrace
} = require('../../src/usecases/qualityPatrol/buildConversationReviewUnitsFromDesktopTrace');

test('phase859: desktop trace bridge builds a review unit that the evaluator can consume', async () => {
  const result = await buildConversationReviewUnitsFromDesktopTrace({
    trace: {
      run_id: 'ldp_test_trace_01',
      scenario_id: 'city_followup_eval',
      session_id: 'session_eval_01',
      started_at: '2026-03-26T01:00:00.000Z',
      finished_at: '2026-03-26T01:00:05.000Z',
      target_id: 'sample-self-test',
      sent_text: '渋谷区で保育園申請を進める次の手順を知りたいです。',
      visible_before: [
        { role: 'assistant', text: '前回は必要書類の確認まで整理しました。' }
      ],
      visible_after: [
        { role: 'user', text: '渋谷区で保育園申請を進める次の手順を知りたいです。' },
        { role: 'assistant', text: 'まず渋谷区の申請窓口で必要書類を確認し、その後に申請日程を予約してください。' }
      ],
      screenshot_before: null,
      screenshot_after: '/tmp/desktop_after.png',
      ax_tree_before: null,
      ax_tree_after: '/tmp/desktop_after.ax.json',
      retrieval_refs: [],
      failure_reason: null,
      scenario_expectations: {
        expected_routing: ['city', 'follow-up']
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.reviewUnits.length, 1);
  assert.equal(result.reviewUnits[0].slice, 'follow-up');
  assert.equal(result.reviewUnits[0].assistantReply.available, true);
  assert.equal(result.reviewUnits[0].userMessage.available, true);
  assert.ok(result.reviewUnits[0].sourceCollections.includes('line_desktop_patrol_trace'));
  assert.ok(result.reviewUnits[0].evidenceRefs.some((item) => item.source === 'line_desktop_patrol_trace'));
  assert.equal(result.transcriptCoverage.transcriptCoverageStatus, 'ready');
});
