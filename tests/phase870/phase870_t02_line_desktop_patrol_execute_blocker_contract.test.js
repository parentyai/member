'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildConversationReviewUnitsFromDesktopTrace
} = require('../../src/usecases/qualityPatrol/buildConversationReviewUnitsFromDesktopTrace');

test('phase870: execute trace bridge surfaces execute-specific observation blockers', async () => {
  const result = await buildConversationReviewUnitsFromDesktopTrace({
    trace: {
      run_id: 'ldp_execute_trace_02',
      scenario_id: 'execute_followup_gap',
      session_id: 'session_execute_02',
      started_at: '2026-03-26T05:00:00.000Z',
      finished_at: '2026-03-26T05:00:05.000Z',
      target_id: 'sample-self-test',
      sent_text: '次の確認事項を教えてください。',
      send_mode: 'execute_once',
      send_result: { result: { status: 'sent' } },
      target_validation: { matched: false, reason: 'window_title_mismatch' },
      correlation_status: 'post_send_reply_ambiguous',
      visible_before: [],
      visible_after: [
        { role: 'unknown', text: '次の確認事項を教えてください。' }
      ],
      screenshot_before: null,
      screenshot_after: null,
      ax_tree_before: null,
      ax_tree_after: null,
      retrieval_refs: [],
      failure_reason: 'send_not_confirmed',
      scenario_expectations: {
        expected_routing: ['follow-up']
      }
    }
  });

  const blockerCodes = result.reviewUnits[0].observationBlockers.map((item) => item.code);
  assert.ok(blockerCodes.includes('target_validation_failed'));
  assert.ok(blockerCodes.includes('send_not_confirmed'));
  assert.ok(blockerCodes.includes('visible_correlation_ambiguous'));
  assert.equal(result.transcriptCoverage.transcriptCoverageStatus, 'blocked');
});
