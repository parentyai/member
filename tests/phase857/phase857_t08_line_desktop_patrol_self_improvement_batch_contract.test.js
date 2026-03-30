'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildCaseLoopArguments,
  buildBatchPreflight,
  buildBlockedCaseResult,
  buildFollowupSuggestion,
  buildScenarioSuite,
  consecutiveFailureCount,
  extractLatestAssistantReply,
  loadExploreLibrary,
  listRecentTraceArtifacts,
  loadStrategicBatch,
  parseCsvList,
  scoreReplyContract,
  selectExploreCases,
  selectExploreCasesByIds,
  shouldSkipEvalForLoopFailure,
  shouldStopBatchOnErrorCode,
  summarizeRound,
} = require('../../tools/line_desktop_patrol/run_desktop_self_improvement_batch');

test('phase857: strategic self improvement batch stays fixed at ten strategic cases', () => {
  const batch = loadStrategicBatch();
  assert.equal(batch.fixedCaseCount, 10);
  assert.equal(batch.cases.length, 10);
  assert.ok(batch.cases.every((item) => item.caseMode === 'core'));
  assert.ok(batch.cases.every((item) => item.strategicGoal.length > 0));
  assert.ok(batch.cases.every((item) => item.improvementAxis.length > 0));
});

test('phase857: fixed core batch reintroduces explicit school grounding after the housing correction turn', () => {
  const batch = loadStrategicBatch();
  const caseMap = new Map(batch.cases.map((item) => [item.caseId, item]));
  [
    'city_specificity_new_york_city',
    'official_confirmation_guard',
    'parent_friendly_rephrase',
    'single_todo_now',
    'document_pair_specificity',
    'reservation_pointer',
    'close_with_two_line_plan',
  ].forEach((caseId) => {
    const userInput = String(caseMap.get(caseId)?.userInput || '');
    assert.match(userInput, /(学校|小学生)/, `${caseId}: explicit school grounding missing`);
  });
});

test('phase857: explore library exposes families and seeded selection stays reproducible', () => {
  const library = loadExploreLibrary();
  const left = selectExploreCases(library, 5, 'seed-123');
  const right = selectExploreCases(library, 5, 'seed-123');
  assert.ok(library.families.length >= 6);
  assert.equal(left.selectedCases.length, 5);
  assert.deepEqual(left.selectedCaseIds, right.selectedCaseIds);
  assert.deepEqual(left.selectedFamilies, right.selectedFamilies);
});

test('phase857: explicit explore case selection preserves requested order', () => {
  const library = loadExploreLibrary();
  const selected = selectExploreCasesByIds(library, 'journey_entry_common_start,city_known_short_pointer');
  assert.deepEqual(parseCsvList('journey_entry_common_start,city_known_short_pointer'), selected.selectedCaseIds);
  assert.equal(selected.selectedCases[0].caseId, 'journey_entry_common_start');
  assert.equal(selected.selectedCases[1].caseId, 'city_known_short_pointer');
});

test('phase857: scenario suite combines fixed core cases with selected explore cases', () => {
  const batch = loadStrategicBatch();
  const library = loadExploreLibrary();
  const exploreSelection = selectExploreCases(library, 4, 'seed-456');
  const suite = buildScenarioSuite(batch, exploreSelection);
  assert.equal(suite.coreCaseCount, 10);
  assert.equal(suite.exploreCaseCount, 4);
  assert.equal(suite.totalCaseCount, 14);
  assert.equal(suite.cases.slice(0, 10).every((item) => item.caseMode === 'core'), true);
  assert.equal(suite.cases.slice(10).every((item) => item.caseMode === 'explore'), true);
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
  const suite = buildScenarioSuite(batch, {
    selectionSeed: 'seed-789',
    selectedCases: [
      {
        caseId: 'explore_case_1',
        strategicGoal: 'Explore family case',
        improvementAxis: 'explore_axis',
        caseMode: 'explore',
        explorationFamily: 'notification',
        userInput: 'text',
        expectedReplySubstrings: [],
        forbiddenReplySubstrings: [],
        replyContract: {
          mustIncludeAny: ['確認'],
          maxLines: 1,
          maxChars: 70,
          disallowQuestion: true,
        },
      },
    ],
    selectedCaseIds: ['explore_case_1'],
    selectedFamilies: ['notification'],
  });
  const results = suite.cases.map((item, index) => ({
    caseId: item.caseId,
    improvementAxis: item.improvementAxis,
    caseMode: item.caseMode,
    explorationFamily: item.explorationFamily || null,
    loopVerdict: index === 0 ? 'pass' : 'fail',
    caseVerdict: index === 0 ? 'pass' : 'fail',
    planningProposals: index === 1 ? [{ proposalType: 'runtime_fix', title: 'example', targetFiles: [] }] : [],
    promotionResult: { status: 'queued', proposalIds: [] },
    replyContract: { verdict: index === 0 },
  }));
  const summary = summarizeRound(suite, results);
  assert.equal(summary.passCount, 1);
  assert.equal(summary.failCount, suite.totalCaseCount - 1);
  assert.equal(summary.proposalCount, 1);
  assert.equal(summary.modeBreakdown.core.total, 10);
  assert.equal(summary.modeBreakdown.explore.total, 1);
  assert.equal(summary.explorationFamilies.notification.total, 1);
  assert.equal(summary.completionStatus, 'proposal_review_required');
});

test('phase857: followup suggestion emits rerun command for failing explore cases', () => {
  const suggestion = buildFollowupSuggestion([
    { caseId: 'core_case', caseMode: 'core', caseVerdict: 'fail' },
    { caseId: 'journey_entry_common_start', caseMode: 'explore', caseVerdict: 'fail' },
    { caseId: 'city_known_short_pointer', caseMode: 'explore', caseVerdict: 'pass' },
    { caseId: 'journey_close_two_step_plan', caseMode: 'explore', caseVerdict: 'fail' },
  ], {
    targetAlias: 'sample-self-test',
    sendMode: 'execute',
  });
  assert.equal(suggestion.focusAvailable, true);
  assert.deepEqual(suggestion.failingExploreCaseIds, [
    'journey_entry_common_start',
    'journey_close_two_step_plan',
  ]);
  assert.match(suggestion.rerunCommand, /--explore-case-ids journey_entry_common_start,journey_close_two_step_plan/);
});

test('phase857: budget preflight fails closed when remaining hourly budget is smaller than fixed batch size', () => {
  const batch = loadStrategicBatch();
  const originalEnv = process.env.LINE_DESKTOP_PATROL_POLICY_PATH;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'line-patrol-policy-'));
  const tempPolicyPath = path.join(tempDir, 'policy.json');
  fs.writeFileSync(
    tempPolicyPath,
    JSON.stringify(
      {
        enabled: true,
        max_runs_per_hour: 5,
        failure_streak_threshold: 3,
        targets: [
          {
            alias: 'sample-self-test',
            allowed_send_modes: ['dry_run', 'execute'],
          },
        ],
      },
      null,
      2
    )
  );
  try {
    process.env.LINE_DESKTOP_PATROL_POLICY_PATH = tempPolicyPath;
    const preflight = buildBatchPreflight(batch, 'execute', 15);
    assert.equal(preflight.stage, 'budget_preflight');
    assert.equal(preflight.code, 'insufficient_hourly_budget');
    assert.equal(typeof preflight.recentRunCount, 'number');
    assert.equal(typeof preflight.maxRunsPerHour, 'number');
    assert.equal(preflight.requiredSlots, 15);
  } finally {
    if (typeof originalEnv === 'string') {
      process.env.LINE_DESKTOP_PATROL_POLICY_PATH = originalEnv;
    } else {
      delete process.env.LINE_DESKTOP_PATROL_POLICY_PATH;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('phase857: blocked case result preserves blocker code for later cases', () => {
  const batch = loadStrategicBatch();
  const blocked = buildBlockedCaseResult(batch.cases[2], {
    code: 'rate_limited',
    error: 'max_runs_per_hour exceeded',
  }, 2, batch.fixedCaseCount);
  assert.equal(blocked.caseId, batch.cases[2].caseId);
  assert.equal(blocked.loopVerdict, 'blocked');
  assert.equal(blocked.loopErrorCode, 'rate_limited');
  assert.equal(blocked.replyContract.verdict, false);
});

test('phase857: session logout is treated as a blocking batch error and skips eval work', () => {
  assert.equal(shouldStopBatchOnErrorCode('desktop_session_logged_out'), true);
  assert.equal(shouldSkipEvalForLoopFailure(false, 'desktop_session_logged_out'), true);
  assert.equal(shouldSkipEvalForLoopFailure(true, 'desktop_session_logged_out'), false);
});

test('phase857: recent trace helpers expose ordered evidence for budget checks', () => {
  const rows = listRecentTraceArtifacts(24);
  assert.equal(Array.isArray(rows), true);
  if (rows.length >= 2) {
    const left = String(rows[rows.length - 2].finished_at || rows[rows.length - 2].started_at || '');
    const right = String(rows[rows.length - 1].finished_at || rows[rows.length - 1].started_at || '');
    assert.equal(left <= right, true);
  }
  assert.equal(typeof consecutiveFailureCount(rows), 'number');
});
