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

test('phase870: execute trace bridge hydrates sparse desktop traces from sibling result artifacts', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase870-execute-result-bridge-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const runRoot = path.join(tempRoot, 'artifacts', 'runs', 'line-patrol-result-bridge');
  fs.mkdirSync(runRoot, { recursive: true });
  const tracePath = path.join(runRoot, 'trace.json');
  fs.writeFileSync(tracePath, JSON.stringify({
    run_id: 'line-patrol-result-bridge',
    scenario_id: 'desktop_conversation_loop',
    session_id: 'session_execute_result_bridge',
    started_at: '2026-03-28T13:27:00.000Z',
    finished_at: '2026-03-28T13:27:25.000Z',
    target_id: 'sample-self-test',
    sent_text: 'ニューヨークの学校手続きで最初に確認することは？3点だけ教えて。',
    visible_before: [],
    visible_after: []
  }, null, 2));
  fs.writeFileSync(path.join(runRoot, 'result.json'), JSON.stringify({
    ok: true,
    result: {
      mode: 'execute',
      targetMatchedHeuristic: true,
      replyObserved: true,
      transcriptBefore: '2026.03.28 Saturday',
      transcriptAfterSend: [
        '2026.03.28 Saturday',
        '09:27 Arumamih$ ニューヨークの学校手続きで最初に確認することは？3点だけ教えて。'
      ].join('\n'),
      transcriptAfterReply: [
        '2026.03.28 Saturday',
        '09:27 Arumamih$ ニューヨークの学校手続きで最初に確認することは？3点だけ教えて。',
        '09:27 メンバー 都市が分かっているなら、まず現地の教育窓口で対象校の条件、必要書類、受付期限の3点だけ確認すると進めやすいです。',
        'その3点が見えると、次に何を優先するかかなり決めやすくなります。'
      ].join('\n'),
      evaluatorScores: {
        sentVisible: true,
        replyObserved: true,
        verdict: 'pass'
      }
    }
  }, null, 2));

  const result = await buildConversationReviewUnitsFromDesktopTrace({ tracePath });

  assert.equal(result.ok, true);
  assert.equal(result.reviewUnits.length, 1);
  assert.equal(result.reviewUnits[0].userMessage.text, 'ニューヨークの学校手続きで最初に確認することは？3点だけ教えて。');
  assert.equal(result.reviewUnits[0].assistantReply.text, [
    '都市が分かっているなら、まず現地の教育窓口で対象校の条件、必要書類、受付期限の3点だけ確認すると進めやすいです。',
    'その3点が見えると、次に何を優先するかかなり決めやすくなります。'
  ].join('\n'));
  assert.equal(result.reviewUnits[0].executeMetadata.sendMode, 'execute_once');
  assert.equal(result.reviewUnits[0].evidenceJoinStatus.actionLog, 'result_bridge');
  assert.equal(result.reviewUnits[0].observationBlockers.some((item) => item.code === 'missing_action_log_evidence'), false);
  assert.equal(result.transcriptCoverage.transcriptCoverageStatus, 'ready');
  assert.ok(result.sourceCollections.includes('line_desktop_patrol_result'));
  assert.equal(result.counts.traceBundles, 1);
});
