'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildConversationReviewUnitsFromDesktopTrace
} = require('../../src/usecases/qualityPatrol/buildConversationReviewUnitsFromDesktopTrace');

test('phase870: execute trace bridge infers user message and assistant reply from unknown visible rows', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase870-execute-bridge-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const result = await buildConversationReviewUnitsFromDesktopTrace({
    trace: {
      run_id: 'ldp_execute_trace_01',
      scenario_id: 'execute_city_followup',
      session_id: 'session_execute_01',
      started_at: '2026-03-26T04:00:00.000Z',
      finished_at: '2026-03-26T04:00:05.000Z',
      target_id: 'sample-self-test',
      sent_text: '住民票の取得手順を教えてください。',
      send_mode: 'execute_once',
      send_result: { result: { status: 'sent' } },
      correlation_status: 'reply_observed',
      visible_before: [
        { role: 'unknown', text: '前回は必要書類を整理しました。' }
      ],
      visible_after: [
        { role: 'unknown', text: '前回は必要書類を整理しました。' },
        { role: 'unknown', text: '住民票の取得手順を教えてください。' },
        { role: 'unknown', text: 'まず市区町村の窓口かコンビニ交付の可否を確認してください。' }
      ],
      screenshot_before: null,
      screenshot_after: path.join(tempRoot, 'after.png'),
      ax_tree_before: null,
      ax_tree_after: path.join(tempRoot, 'after.ax.json'),
      retrieval_refs: [],
      failure_reason: 'execute_queued',
      scenario_expectations: {
        expected_routing: ['city', 'follow-up']
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.reviewUnits.length, 1);
  assert.equal(result.reviewUnits[0].userMessage.text, '住民票の取得手順を教えてください。');
  assert.equal(result.reviewUnits[0].assistantReply.text, 'まず市区町村の窓口かコンビニ交付の可否を確認してください。');
  assert.equal(result.reviewUnits[0].executeMetadata.sendMode, 'execute_once');
  assert.equal(result.reviewUnits[0].executeMetadata.replyObservationStatus, 'reply_observed');
  assert.equal(result.transcriptCoverage.transcriptCoverageStatus, 'ready');
});
