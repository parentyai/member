'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCaseLoopArguments,
  extractLatestAssistantReply,
  loadStrategicBatch,
  scoreReplyContract,
  summarizeRound,
} = require('../../tools/line_desktop_patrol/run_desktop_self_improvement_batch');

test('phase857: strategic self improvement batch stays fixed at ten strategic cases', () => {
  const batch = loadStrategicBatch();
  assert.equal(batch.fixedCaseCount, 10);
  assert.equal(batch.cases.length, 10);
  assert.ok(batch.cases.every((item) => item.strategicGoal.length > 0));
  assert.ok(batch.cases.every((item) => item.improvementAxis.length > 0));
});

test('phase857: strategic batch loop arguments preserve scenario metadata and reply expectations', () => {
  const batch = loadStrategicBatch();
  const call = buildCaseLoopArguments({
    targetAlias: 'sample-self-test',
    sendMode: 'execute',
    observeSeconds: 25,
    pollSeconds: 2,
  }, batch.cases[0]);
  assert.equal(call.target_alias, 'sample-self-test');
  assert.equal(call.target_confirmation, 'sample-self-test');
  assert.equal(call.scenario_id, batch.cases[0].caseId);
  assert.deepEqual(call.expected_reply_substrings, batch.cases[0].expectedReplySubstrings);
});

test('phase857: reply contract scoring fails closed on awkward question-shaped replies', () => {
  const batch = loadStrategicBatch();
  const score = scoreReplyContract(batch.cases[0], '何を確認しますか？');
  assert.equal(score.containsQuestion, true);
  assert.equal(score.questionPolicyOk, false);
  assert.equal(score.verdict, false);
});

test('phase857: assistant reply extraction keeps the final member message', () => {
  const reply = extractLatestAssistantReply({
    result: {
      visibleAfter: [
        { role: 'visible_text', text: '10:00 Arumamih$ 質問です' },
        { role: 'visible_text', text: '10:00 メンバー 最初に期限を確認する。' },
        { role: 'visible_text', text: '次に必要書類を見る。' },
      ],
    },
  });
  assert.equal(reply, '最初に期限を確認する。\n次に必要書類を見る。');
});

test('phase857: strategic round summary reports proposal review when any case fails or proposes changes', () => {
  const batch = loadStrategicBatch();
  const results = batch.cases.map((item, index) => ({
    caseId: item.caseId,
    improvementAxis: item.improvementAxis,
    loopVerdict: index === 0 ? 'pass' : 'fail',
    caseVerdict: index === 0 ? 'pass' : 'fail',
    planningProposals: index === 1 ? [{ proposalType: 'runtime_fix', title: 'example', targetFiles: [] }] : [],
    replyContract: { verdict: index === 0 },
  }));
  const summary = summarizeRound(batch, results);
  assert.equal(summary.passCount, 1);
  assert.equal(summary.failCount, 9);
  assert.equal(summary.proposalCount, 1);
  assert.equal(summary.completionStatus, 'proposal_review_required');
});
