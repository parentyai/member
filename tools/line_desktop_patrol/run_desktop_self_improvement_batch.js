'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  createClient,
  initializeClient,
  callTool,
  getReadinessResult,
} = require('./run_local_mcp_tool');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_BATCH_PATH = path.join(__dirname, 'scenarios', 'strategic_self_improvement_batch_v1.json');
const DEFAULT_EXPLORE_LIBRARY_PATH = path.join(__dirname, 'scenarios', 'strategic_self_improvement_explore_library_v1.json');
const DEFAULT_POLICY_PATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'config', 'policy.local.json');
const DEFAULT_QUEUE_ROOT = path.join(ROOT, 'artifacts', 'line_desktop_patrol', 'proposals');
const DEFAULT_BASE_REF = 'origin/main';
const DEFAULT_EXPLORE_COUNT = 5;
const STOP_BATCH_ERROR_CODES = new Set([
  'blocked_hours',
  'desktop_session_logged_out',
  'desktop_target_title_guard',
  'failure_streak_threshold_reached',
  'kill_switch_on',
  'policy_disabled',
  'rate_limited',
  'send_mode_not_allowed',
  'target_confirmation_required',
]);

function shouldStopBatchOnErrorCode(code) {
  return STOP_BATCH_ERROR_CODES.has(normalizeText(code));
}

function shouldSkipEvalForLoopFailure(loopOk, loopErrorCode) {
  return loopOk !== true && shouldStopBatchOnErrorCode(loopErrorCode);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (typeof next === 'string' && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function toInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) throw new Error(`invalid integer: ${value}`);
  return parsed;
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseCsvList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(String(item))).filter(Boolean);
  }
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(',').map((item) => normalizeText(item)).filter(Boolean);
}

function buildHashKey(seed, value) {
  return crypto.createHash('sha256').update(`${seed}::${value}`).digest('hex');
}

function normalizeCaseDefinition(item, index, options = {}) {
  const payload = item && typeof item === 'object' ? item : null;
  if (!payload) {
    throw new Error(`${options.sourceLabel || 'case'} ${index} must be an object`);
  }
  const replyContract = payload.reply_contract;
  if (!replyContract || typeof replyContract !== 'object') {
    throw new Error(`${options.sourceLabel || 'case'} ${index} reply_contract is required`);
  }
  const mustIncludeAny = Array.isArray(replyContract.must_include_any)
    ? replyContract.must_include_any.map((row) => normalizeText(String(row))).filter(Boolean)
    : [];
  if (mustIncludeAny.length === 0) {
    throw new Error(`${options.sourceLabel || 'case'} ${index} must include reply_contract.must_include_any`);
  }
  const normalized = {
    caseId: requireString(payload.case_id, `${options.sourceLabel || 'cases'}[${index}].case_id`),
    strategicGoal: requireString(payload.strategic_goal, `${options.sourceLabel || 'cases'}[${index}].strategic_goal`),
    improvementAxis: requireString(payload.improvement_axis, `${options.sourceLabel || 'cases'}[${index}].improvement_axis`),
    userInput: requireString(payload.user_input, `${options.sourceLabel || 'cases'}[${index}].user_input`),
    expectedReplySubstrings: (Array.isArray(payload.expected_reply_substrings) ? payload.expected_reply_substrings : [])
      .map((row) => normalizeText(String(row)))
      .filter(Boolean),
    forbiddenReplySubstrings: (Array.isArray(payload.forbidden_reply_substrings) ? payload.forbidden_reply_substrings : [])
      .map((row) => normalizeText(String(row)))
      .filter(Boolean),
    replyContract: {
      mustIncludeAny,
      maxLines: toInt(replyContract.max_lines, 2),
      maxChars: toInt(replyContract.max_chars, 90),
      disallowQuestion: replyContract.disallow_question === true,
    },
    caseMode: options.caseMode || 'core',
    explorationFamily: null,
  };
  if (options.caseMode === 'explore') {
    normalized.explorationFamily = requireString(
      payload.exploration_family,
      `${options.sourceLabel || 'cases'}[${index}].exploration_family`
    );
  }
  return normalized;
}

function resolvePolicyPath() {
  const candidates = [
    process.env.LINE_DESKTOP_PATROL_POLICY_PATH,
    DEFAULT_POLICY_PATH,
  ].filter((item) => typeof item === 'string' && item.trim());
  for (const item of candidates) {
    const resolved = path.resolve(item);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return null;
}

function loadPolicyRuntime() {
  const policyPath = resolvePolicyPath();
  if (!policyPath) {
    return {
      ok: false,
      code: 'policy_path_missing',
      policyPath: null,
    };
  }
  const payload = readJson(policyPath);
  return {
    ok: true,
    policyPath,
    maxRunsPerHour: Number(payload.max_runs_per_hour),
    failureStreakThreshold: Number(payload.failure_streak_threshold),
    enabled: payload.enabled === true,
    proposalMode: normalizeText(payload.proposal_mode) || 'off',
    autoApplyLevel: normalizeText(payload.auto_apply_level) || 'none',
  };
}

function loadPolicyBudget() {
  return loadPolicyRuntime();
}

function buildPythonEnv(extraEnv) {
  const pythonRoot = path.join(ROOT, 'tools', 'line_desktop_patrol', 'src');
  const inheritedPythonPath = normalizeText(process.env.PYTHONPATH);
  return {
    ...process.env,
    ...(extraEnv && typeof extraEnv === 'object' ? extraEnv : {}),
    PYTHONPATH: inheritedPythonPath
      ? `${pythonRoot}${path.delimiter}${inheritedPythonPath}`
      : pythonRoot,
  };
}

function parseJsonOutput(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  return JSON.parse(normalized);
}

function loadStrategicBatch(batchPath = DEFAULT_BATCH_PATH) {
  const resolved = path.resolve(ROOT, batchPath);
  const payload = readJson(resolved);
  if (!payload || typeof payload !== 'object') {
    throw new Error('strategic batch must be an object');
  }
  if (normalizeText(payload.batch_id).length < 3) {
    throw new Error('batch_id is required');
  }
  const expectedCount = Number(payload.fixed_case_count);
  const cases = Array.isArray(payload.cases) ? payload.cases : [];
  if (!Number.isFinite(expectedCount) || expectedCount !== 10) {
    throw new Error('fixed_case_count must stay 10');
  }
  if (cases.length !== expectedCount) {
    throw new Error(`strategic batch must contain exactly ${expectedCount} cases`);
  }
  const normalizedCases = cases.map((item, index) => normalizeCaseDefinition(item, index, {
    sourceLabel: 'cases',
    caseMode: 'core',
  }));

  return {
    batchId: payload.batch_id,
    description: normalizeText(payload.description),
    fixedCaseCount: expectedCount,
    autoApplyMode: normalizeText(payload.auto_apply_mode) || 'proposal_only',
    futureAutomationGoal: normalizeText(payload.future_automation_goal),
    path: resolved,
    cases: normalizedCases,
  };
}

function loadExploreLibrary(libraryPath = DEFAULT_EXPLORE_LIBRARY_PATH) {
  const resolved = path.resolve(ROOT, libraryPath);
  const payload = readJson(resolved);
  if (!payload || typeof payload !== 'object') {
    throw new Error('explore library must be an object');
  }
  if (normalizeText(payload.library_id).length < 3) {
    throw new Error('explore library library_id is required');
  }
  const cases = Array.isArray(payload.cases) ? payload.cases : [];
  if (cases.length === 0) {
    throw new Error('explore library must contain at least one case');
  }
  const normalizedCases = cases.map((item, index) => normalizeCaseDefinition(item, index, {
    sourceLabel: 'explore_cases',
    caseMode: 'explore',
  }));
  const families = Array.from(new Set(normalizedCases.map((item) => item.explorationFamily))).sort();
  if (families.length === 0) {
    throw new Error('explore library must contain at least one exploration family');
  }
  return {
    libraryId: payload.library_id,
    description: normalizeText(payload.description),
    path: resolved,
    families,
    cases: normalizedCases,
  };
}

function selectExploreCases(library, count = DEFAULT_EXPLORE_COUNT, seed) {
  const requestedCount = Math.max(toInt(count, DEFAULT_EXPLORE_COUNT), 0);
  const selectionSeed = normalizeText(seed) || crypto.randomUUID();
  if (!library || !Array.isArray(library.cases)) {
    throw new Error('explore library cases are required');
  }
  if (requestedCount === 0 || library.cases.length === 0) {
    return {
      selectionSeed,
      requestedCount,
      selectedCases: [],
      selectedCaseIds: [],
      selectedFamilies: [],
    };
  }

  const familyOrder = library.families
    .slice()
    .sort((left, right) => buildHashKey(selectionSeed, `family:${left}`).localeCompare(buildHashKey(selectionSeed, `family:${right}`)));
  const selected = [];
  const seenIds = new Set();
  for (const family of familyOrder) {
    if (selected.length >= requestedCount) break;
    const familyCases = library.cases
      .filter((item) => item.explorationFamily === family)
      .slice()
      .sort((left, right) => buildHashKey(selectionSeed, `case:${left.caseId}`).localeCompare(buildHashKey(selectionSeed, `case:${right.caseId}`)));
    const candidate = familyCases[0];
    if (!candidate) continue;
    selected.push(candidate);
    seenIds.add(candidate.caseId);
  }
  if (selected.length < requestedCount) {
    const remaining = library.cases
      .filter((item) => !seenIds.has(item.caseId))
      .slice()
      .sort((left, right) => buildHashKey(selectionSeed, `case:${left.caseId}`).localeCompare(buildHashKey(selectionSeed, `case:${right.caseId}`)));
    for (const candidate of remaining) {
      if (selected.length >= requestedCount) break;
      selected.push(candidate);
      seenIds.add(candidate.caseId);
    }
  }
  return {
    selectionSeed,
    requestedCount,
    selectedCases: selected,
    selectedCaseIds: selected.map((item) => item.caseId),
    selectedFamilies: Array.from(new Set(selected.map((item) => item.explorationFamily))).sort(),
  };
}

function selectExploreCasesByIds(library, requestedIds) {
  const ids = Array.from(new Set(parseCsvList(requestedIds)));
  if (!library || !Array.isArray(library.cases)) {
    throw new Error('explore library cases are required');
  }
  const caseIndex = new Map(library.cases.map((item) => [item.caseId, item]));
  const selectedCases = ids.map((caseId) => {
    const match = caseIndex.get(caseId);
    if (!match) throw new Error(`unknown explore case id: ${caseId}`);
    return match;
  });
  return {
    selectionSeed: '',
    requestedCount: ids.length,
    selectedCases,
    selectedCaseIds: ids,
    selectedFamilies: Array.from(new Set(selectedCases.map((item) => item.explorationFamily))).sort(),
  };
}

function buildScenarioSuite(batch, exploreSelection) {
  const selectedExploreCases = exploreSelection && Array.isArray(exploreSelection.selectedCases)
    ? exploreSelection.selectedCases
    : [];
  return {
    suiteId: selectedExploreCases.length > 0 ? `${batch.batchId}__core_plus_explore` : `${batch.batchId}__core_only`,
    batchId: batch.batchId,
    batchDescription: batch.description,
    coreCaseCount: batch.fixedCaseCount,
    exploreCaseCount: selectedExploreCases.length,
    totalCaseCount: batch.fixedCaseCount + selectedExploreCases.length,
    selectionSeed: exploreSelection ? exploreSelection.selectionSeed : '',
    selectedExploreCaseIds: exploreSelection ? exploreSelection.selectedCaseIds : [],
    selectedExploreFamilies: exploreSelection ? exploreSelection.selectedFamilies : [],
    cases: batch.cases.concat(selectedExploreCases),
  };
}

function buildFollowupSuggestion(caseResults, params = {}) {
  const failingExploreCaseIds = caseResults
    .filter((item) => item.caseMode === 'explore' && item.caseVerdict !== 'pass')
    .map((item) => item.caseId);
  const targetAlias = normalizeText(params.targetAlias);
  const sendMode = normalizeText(params.sendMode) || 'execute';
  if (failingExploreCaseIds.length === 0 || !targetAlias) {
    return {
      focusAvailable: false,
      failingExploreCaseIds,
      rerunCommand: null,
    };
  }
  return {
    focusAvailable: true,
    failingExploreCaseIds,
    rerunCommand: `npm run line-desktop-patrol:desktop-self-improvement -- --target-alias ${targetAlias} --send-mode ${sendMode} --explore-case-ids ${failingExploreCaseIds.join(',')}`,
  };
}

function buildCaseLoopArguments(commonArgs, caseDefinition) {
  return {
    target_alias: commonArgs.targetAlias,
    target_confirmation: commonArgs.targetAlias,
    text: caseDefinition.userInput,
    scenario_id: caseDefinition.caseId,
    send_mode: commonArgs.sendMode,
    observe_seconds: commonArgs.observeSeconds,
    poll_seconds: commonArgs.pollSeconds,
    expected_reply_substrings: caseDefinition.expectedReplySubstrings,
    forbidden_reply_substrings: caseDefinition.forbiddenReplySubstrings,
  };
}

function isDateDivider(text) {
  return /^\d{4}\.\d{2}\.\d{2}\b/u.test(text);
}

function parseVisibleMessages(rows) {
  const messages = [];
  let current = null;
  for (const row of Array.isArray(rows) ? rows : []) {
    const text = normalizeText(row && row.text);
    if (!text || isDateDivider(text)) continue;
    const timestamped = text.match(/^(\d{1,2}:\d{2})\s+(\S+)\s+(.+)$/u);
    if (timestamped) {
      current = {
        speaker: normalizeText(timestamped[2]),
        text: normalizeText(timestamped[3]),
      };
      messages.push(current);
      continue;
    }
    if (current) {
      current.text = normalizeText(`${current.text}\n${text}`);
      continue;
    }
    current = { speaker: '', text };
    messages.push(current);
  }
  return messages.filter((item) => item.text);
}

function extractLatestAssistantReply(loopPayload) {
  const nested = loopPayload && loopPayload.result && typeof loopPayload.result === 'object'
    ? loopPayload.result
    : {};
  const messages = parseVisibleMessages(nested.visibleAfter);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.speaker.includes('メンバー')) {
      return message.text;
    }
  }
  return '';
}

function scoreReplyContract(caseDefinition, replyText) {
  const normalizedReply = normalizeText(replyText);
  const lines = normalizedReply ? normalizedReply.split(/\r?\n/).map((line) => normalizeText(line)).filter(Boolean) : [];
  const containsQuestion = /[？?]/u.test(normalizedReply);
  const mustIncludeMatched = caseDefinition.replyContract.mustIncludeAny.some((item) => normalizedReply.includes(item));
  const maxLinesOk = lines.length > 0 && lines.length <= caseDefinition.replyContract.maxLines;
  const maxCharsOk = normalizedReply.length > 0 && normalizedReply.length <= caseDefinition.replyContract.maxChars;
  const forbiddenHit = caseDefinition.forbiddenReplySubstrings.some((item) => normalizedReply.includes(item));
  const questionPolicyOk = caseDefinition.replyContract.disallowQuestion ? containsQuestion === false : true;
  const verdict = mustIncludeMatched && maxLinesOk && maxCharsOk && !forbiddenHit && questionPolicyOk;
  return {
    replyText: normalizedReply,
    lineCount: lines.length,
    charCount: normalizedReply.length,
    containsQuestion,
    mustIncludeMatched,
    forbiddenHit,
    maxLinesOk,
    maxCharsOk,
    questionPolicyOk,
    verdict,
  };
}

function runDesktopEval(tracePath, outputRoot, caseId) {
  const mainOutputPath = path.join(outputRoot, `${caseId}.desktop_patrol_eval.json`);
  const planningOutputPath = path.join(outputRoot, `${caseId}.desktop_patrol_planning.json`);
  const completed = spawnSync(
    'node',
    [
      path.join(ROOT, 'tools', 'quality_patrol', 'run_desktop_patrol_eval.js'),
      '--trace',
      tracePath,
      '--output',
      mainOutputPath,
      '--planning-output',
      planningOutputPath,
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
    }
  );
  if (completed.status !== 0) {
    return {
      ok: false,
      error: normalizeText(completed.stderr) || normalizeText(completed.stdout) || 'desktop patrol eval failed',
      mainOutputPath,
      planningOutputPath,
      mainArtifact: null,
      planningArtifact: null,
    };
  }
  return {
    ok: true,
    error: null,
    mainOutputPath,
    planningOutputPath,
    mainArtifact: readJson(mainOutputPath),
    planningArtifact: readJson(planningOutputPath),
  };
}

function runEvalProposalQueue(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const queueRoot = path.resolve(payload.queueRoot || DEFAULT_QUEUE_ROOT);
  const args = [
    '-m',
    'member_line_patrol.enqueue_eval_proposals',
    '--trace',
    String(payload.tracePath),
    '--planning-output',
    String(payload.planningOutputPath),
    '--queue-root',
    queueRoot,
  ];
  if (payload.mainOutputPath) {
    args.push('--main-output', String(payload.mainOutputPath));
  }
  const completed = (payload.runner || spawnSync)(
    'python3',
    args,
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: buildPythonEnv(),
    }
  );
  const stdout = normalizeText(completed.stdout);
  const stderr = normalizeText(completed.stderr);
  if (completed.status !== 0) {
    return {
      ok: false,
      status: completed.status,
      queueRoot,
      error: stderr || stdout || 'enqueue_eval_proposals failed',
      stdout,
      stderr,
    };
  }
  try {
    return {
      ok: true,
      status: completed.status,
      queueRoot,
      result: parseJsonOutput(stdout),
      stdout,
      stderr,
    };
  } catch (error) {
    return {
      ok: false,
      status: completed.status,
      queueRoot,
      error: error && error.message ? error.message : 'json_parse_failed',
      stdout,
      stderr,
    };
  }
}

function runPatchDraftSynthesis(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const proposalIds = Array.from(new Set(
    (Array.isArray(payload.proposalIds) ? payload.proposalIds : [])
      .map((item) => normalizeText(String(item)))
      .filter(Boolean)
  ));
  if (proposalIds.length === 0) {
    return {
      ok: true,
      generatedCount: 0,
      proposalIds: [],
      results: [],
      failedIds: [],
    };
  }
  const runner = payload.runner || spawnSync;
  const queueRoot = path.resolve(payload.queueRoot || DEFAULT_QUEUE_ROOT);
  const repoRoot = path.resolve(payload.repoRoot || ROOT);
  const baseRef = normalizeText(payload.baseRef) || DEFAULT_BASE_REF;
  const results = [];
  const failedIds = [];
  proposalIds.forEach((proposalId) => {
    const completed = runner(
      'python3',
      [
        '-m',
        'member_line_patrol.synthesize_code_edit_task',
        '--proposal-id',
        proposalId,
        '--queue-root',
        queueRoot,
        '--repo-root',
        repoRoot,
        '--base-ref',
        baseRef,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: buildPythonEnv(),
      }
    );
    const stdout = normalizeText(completed.stdout);
    const stderr = normalizeText(completed.stderr);
    if (completed.status !== 0) {
      failedIds.push(proposalId);
      results.push({
        ok: false,
        proposalId,
        status: completed.status,
        error: stderr || stdout || 'synthesize_code_edit_task failed',
      });
      return;
    }
    try {
      results.push({
        ok: true,
        proposalId,
        status: completed.status,
        result: parseJsonOutput(stdout),
      });
    } catch (error) {
      failedIds.push(proposalId);
      results.push({
        ok: false,
        proposalId,
        status: completed.status,
        error: error && error.message ? error.message : 'json_parse_failed',
      });
    }
  });
  return {
    ok: failedIds.length === 0,
    generatedCount: results.filter((item) => item.ok === true).length,
    proposalIds,
    results,
    failedIds,
  };
}

function runPromotionPipeline(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const planningProposals = Array.isArray(payload.planningProposals) ? payload.planningProposals : [];
  const policyRuntime = payload.policyRuntime && typeof payload.policyRuntime === 'object'
    ? payload.policyRuntime
    : loadPolicyRuntime();
  if (planningProposals.length === 0) {
    return {
      ok: true,
      status: 'skipped_no_proposals',
      proposalIds: [],
      queueResult: null,
      patchDraftResult: null,
    };
  }
  if (!policyRuntime.ok) {
    return {
      ok: false,
      status: 'policy_unresolved',
      error: policyRuntime.code || 'policy_unresolved',
      proposalIds: [],
      queueResult: null,
      patchDraftResult: null,
    };
  }
  if (policyRuntime.proposalMode !== 'local_queue') {
    return {
      ok: true,
      status: `skipped_proposal_mode_${policyRuntime.proposalMode || 'off'}`,
      proposalIds: [],
      queueResult: null,
      patchDraftResult: null,
    };
  }
  if (!payload.tracePath || !payload.planningOutputPath) {
    return {
      ok: false,
      status: 'promotion_artifacts_missing',
      error: 'tracePath and planningOutputPath are required',
      proposalIds: [],
      queueResult: null,
      patchDraftResult: null,
    };
  }
  const queueRun = runEvalProposalQueue({
    tracePath: payload.tracePath,
    planningOutputPath: payload.planningOutputPath,
    mainOutputPath: payload.mainOutputPath,
    queueRoot: payload.queueRoot,
    runner: payload.runner,
  });
  if (!queueRun.ok) {
    return {
      ok: false,
      status: 'queue_failed',
      error: queueRun.error,
      proposalIds: [],
      queueResult: queueRun,
      patchDraftResult: null,
    };
  }
  const queueResult = queueRun.result || {};
  const proposalIds = Array.from(new Set([
    ...(Array.isArray(queueResult.queuedProposalIds) ? queueResult.queuedProposalIds : []),
    ...(Array.isArray(queueResult.duplicateProposalIds) ? queueResult.duplicateProposalIds : []),
  ]));
  if (policyRuntime.autoApplyLevel !== 'patch_draft') {
    return {
      ok: true,
      status: policyRuntime.autoApplyLevel === 'docs_only' ? 'queued_docs_only' : 'queued',
      proposalIds,
      queueResult,
      patchDraftResult: null,
    };
  }
  const patchDraftResult = runPatchDraftSynthesis({
    proposalIds,
    queueRoot: payload.queueRoot,
    repoRoot: payload.repoRoot,
    baseRef: payload.baseRef,
    runner: payload.runner,
  });
  return {
    ok: patchDraftResult.ok,
    status: patchDraftResult.ok ? 'queued_and_patch_draft_ready' : 'patch_draft_failed',
    error: patchDraftResult.ok ? null : 'patch_draft_failed',
    proposalIds,
    queueResult,
    patchDraftResult,
  };
}

function collectPlanningProposals(planningArtifact) {
  const proposals = planningArtifact && Array.isArray(planningArtifact.recommendedPr)
    ? planningArtifact.recommendedPr
    : [];
  return proposals.map((proposal) => ({
    proposalType: normalizeText(proposal && proposal.proposalType),
    title: normalizeText(proposal && proposal.title),
    objective: normalizeText(proposal && proposal.objective),
    targetFiles: Array.isArray(proposal && proposal.targetFiles) ? proposal.targetFiles : [],
  }));
}

function deriveArtifactPaths(runId) {
  const runRoot = path.join(ROOT, 'artifacts', 'line_desktop_patrol', 'runs', runId);
  return {
    runRoot,
    tracePath: path.join(runRoot, 'trace.json'),
    resultPath: path.join(runRoot, 'result.json'),
  };
}

function listRecentTraceArtifacts(hours = 1) {
  const runRoot = path.join(ROOT, 'artifacts', 'line_desktop_patrol', 'runs');
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  if (!fs.existsSync(runRoot)) return [];
  const rows = [];
  for (const entry of fs.readdirSync(runRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const tracePath = path.join(runRoot, entry.name, 'trace.json');
    if (!fs.existsSync(tracePath)) continue;
    try {
      const trace = readJson(tracePath);
      const finishedAt = normalizeText(trace.finished_at);
      const finishedAtMs = finishedAt ? Date.parse(finishedAt) : NaN;
      if (Number.isFinite(finishedAtMs) && finishedAtMs >= cutoff) {
        rows.push(trace);
      }
    } catch (_error) {
      continue;
    }
  }
  rows.sort((left, right) => String(left.finished_at || left.started_at || '').localeCompare(String(right.finished_at || right.started_at || '')));
  return rows;
}

function consecutiveFailureCount(rows) {
  let count = 0;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (normalizeText(rows[index] && rows[index].failure_reason)) {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

function buildBatchPreflight(batch, sendMode, requiredSlots = batch.fixedCaseCount) {
  if (normalizeText(sendMode) !== 'execute') {
    return {
      ok: true,
      sendMode,
      stage: 'budget_preflight',
      skipped: true,
      reason: 'send_mode_not_execute',
    };
  }
  const policy = loadPolicyBudget();
  if (!policy.ok) {
    return {
      ok: false,
      stage: 'budget_preflight',
      code: policy.code,
      error: 'local policy path could not be resolved for strategic batch preflight',
      policyPath: policy.policyPath,
    };
  }
  const recentRuns = listRecentTraceArtifacts(1);
  const recentRunCount = recentRuns.length;
  const remainingSlots = Math.max(policy.maxRunsPerHour - recentRunCount, 0);
  const failureStreakCount = consecutiveFailureCount(recentRuns);
  if (policy.enabled !== true) {
    return {
      ok: false,
      stage: 'budget_preflight',
      code: 'policy_disabled',
      error: 'local patrol policy is disabled',
      policyPath: policy.policyPath,
      recentRunCount,
      remainingSlots,
      maxRunsPerHour: policy.maxRunsPerHour,
      failureStreakCount,
      failureStreakThreshold: policy.failureStreakThreshold,
      requiredSlots,
    };
  }
  if (remainingSlots < requiredSlots) {
    return {
      ok: false,
      stage: 'budget_preflight',
      code: 'insufficient_hourly_budget',
      error: `remaining hourly budget ${remainingSlots} is below required suite size ${requiredSlots}`,
      policyPath: policy.policyPath,
      recentRunCount,
      remainingSlots,
      maxRunsPerHour: policy.maxRunsPerHour,
      failureStreakCount,
      failureStreakThreshold: policy.failureStreakThreshold,
      requiredSlots,
    };
  }
  if (failureStreakCount >= policy.failureStreakThreshold) {
    return {
      ok: false,
      stage: 'budget_preflight',
      code: 'failure_streak_threshold_reached',
      error: 'failure streak threshold reached before the fixed batch started',
      policyPath: policy.policyPath,
      recentRunCount,
      remainingSlots,
      maxRunsPerHour: policy.maxRunsPerHour,
      failureStreakCount,
      failureStreakThreshold: policy.failureStreakThreshold,
      requiredSlots,
    };
  }
  return {
    ok: true,
    stage: 'budget_preflight',
    policyPath: policy.policyPath,
    recentRunCount,
    remainingSlots,
    maxRunsPerHour: policy.maxRunsPerHour,
    failureStreakCount,
    failureStreakThreshold: policy.failureStreakThreshold,
    requiredSlots,
  };
}

function buildBlockedCaseResult(caseDefinition, blocker, index, batchSize) {
  return {
    caseId: caseDefinition.caseId,
    strategicGoal: caseDefinition.strategicGoal,
    improvementAxis: caseDefinition.improvementAxis,
    caseMode: caseDefinition.caseMode || 'core',
    explorationFamily: caseDefinition.explorationFamily || null,
    userInput: caseDefinition.userInput,
    loopOk: false,
    loopVerdict: 'blocked',
    caseVerdict: 'fail',
    runId: null,
    artifactPaths: { runRoot: null, tracePath: null, resultPath: null },
    loopPayload: {
      ok: false,
      code: blocker.code,
      error: blocker.error,
      blockedAfterCaseIndex: index,
      batchSize,
    },
    loopErrorCode: blocker.code,
    loopError: blocker.error,
    replyContract: {
      replyText: '',
      lineCount: 0,
      charCount: 0,
      containsQuestion: false,
      mustIncludeMatched: false,
      forbiddenHit: false,
      maxLinesOk: false,
      maxCharsOk: false,
      questionPolicyOk: caseDefinition.replyContract.disallowQuestion ? true : true,
      verdict: false,
    },
    planningStatus: 'unavailable',
    analysisStatus: 'unavailable',
    observationStatus: 'unavailable',
    planningProposals: [],
    evalResult: {
      ok: false,
      error: blocker.code,
      mainOutputPath: null,
      planningOutputPath: null,
      mainArtifact: null,
      planningArtifact: null,
    },
  };
}

function summarizeRound(batch, caseResults) {
  const strategicAxes = {};
  const modeBreakdown = {};
  const explorationFamilies = {};
  const proposals = [];
  const promotionSummary = {
    statusCounts: {},
    queuedProposalCount: 0,
    patchDraftReadyCount: 0,
    blockedCaseIds: [],
  };
  let passCount = 0;
  let replyContractPassCount = 0;
  let loopPassCount = 0;
  let proposalCount = 0;
  const failingCaseIds = [];
  for (const result of caseResults) {
    strategicAxes[result.improvementAxis] = strategicAxes[result.improvementAxis] || { total: 0, passed: 0 };
    strategicAxes[result.improvementAxis].total += 1;
    modeBreakdown[result.caseMode] = modeBreakdown[result.caseMode] || { total: 0, passed: 0 };
    modeBreakdown[result.caseMode].total += 1;
    if (result.explorationFamily) {
      explorationFamilies[result.explorationFamily] = explorationFamilies[result.explorationFamily] || { total: 0, passed: 0 };
      explorationFamilies[result.explorationFamily].total += 1;
    }
    if (result.loopVerdict === 'pass') loopPassCount += 1;
    if (result.replyContract && result.replyContract.verdict === true) replyContractPassCount += 1;
    if (result.caseVerdict === 'pass') {
      passCount += 1;
      strategicAxes[result.improvementAxis].passed += 1;
      modeBreakdown[result.caseMode].passed += 1;
      if (result.explorationFamily) {
        explorationFamilies[result.explorationFamily].passed += 1;
      }
    } else {
      failingCaseIds.push(result.caseId);
    }
    for (const proposal of result.planningProposals) {
      proposalCount += 1;
      proposals.push(Object.assign({ caseId: result.caseId }, proposal));
    }
    const promotionStatus = normalizeText(result.promotionResult && result.promotionResult.status) || 'unavailable';
    promotionSummary.statusCounts[promotionStatus] = (promotionSummary.statusCounts[promotionStatus] || 0) + 1;
    promotionSummary.queuedProposalCount += Array.isArray(result.promotionResult && result.promotionResult.proposalIds)
      ? result.promotionResult.proposalIds.length
      : 0;
    promotionSummary.patchDraftReadyCount += Number(
      result.promotionResult
      && result.promotionResult.patchDraftResult
      && result.promotionResult.patchDraftResult.generatedCount
    ) || 0;
    if (result.promotionResult && result.promotionResult.ok === false) {
      promotionSummary.blockedCaseIds.push(result.caseId);
    }
  }
  return {
    batchId: batch.batchId,
    coreCaseCount: batch.coreCaseCount || batch.fixedCaseCount,
    exploreCaseCount: batch.exploreCaseCount || 0,
    totalCaseCount: batch.totalCaseCount || caseResults.length,
    passCount,
    loopPassCount,
    replyContractPassCount,
    failCount: caseResults.length - passCount,
    proposalCount,
    failingCaseIds,
    strategicAxes,
    modeBreakdown,
    explorationFamilies,
    promotionSummary,
    proposals,
    completionStatus: promotionSummary.blockedCaseIds.length > 0
      ? 'promotion_blocked'
      : (
        passCount === (batch.totalCaseCount || caseResults.length) && proposalCount === 0
          ? 'stable_no_improvement_needed'
          : 'proposal_review_required'
      ),
  };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

async function runStrategicSelfImprovementBatch(argv, deps) {
  const args = parseArgs(argv || process.argv.slice(2));
  const batch = loadStrategicBatch(args.batch || DEFAULT_BATCH_PATH);
  const exploreLibrary = loadExploreLibrary(args.exploreLibrary || DEFAULT_EXPLORE_LIBRARY_PATH);
  const requestedExploreCaseIds = parseCsvList(args.exploreCaseIds);
  const explicitExploreSelection = requestedExploreCaseIds.length > 0
    ? selectExploreCasesByIds(exploreLibrary, requestedExploreCaseIds)
    : null;
  const exploreSelectionMode = explicitExploreSelection ? 'explicit_case_ids' : 'seeded_rotation';
  const exploreSelection = explicitExploreSelection || selectExploreCases(exploreLibrary, args.exploreCount, args.seed);
  const suite = buildScenarioSuite(batch, exploreSelection);
  const targetAlias = requireString(args.targetAlias, 'targetAlias');
  const sendMode = normalizeText(args.sendMode) || 'execute';
  const observeSeconds = toInt(args.observeSeconds, 25);
  const pollSeconds = toInt(args.pollSeconds, 2);
  const policyRuntime = loadPolicyRuntime();
  const batchRunId = `desktop-self-improve-${crypto.randomUUID()}`;
  const batchRoot = path.join(ROOT, 'artifacts', 'line_desktop_patrol', 'self_improvement_runs', batchRunId);
  const client = createClient(deps);
  let nextRequestId = 2;

  try {
    await initializeClient(client);
    const readiness = await callTool(client, nextRequestId, {
      name: 'desktop_readiness',
      arguments: { target_alias: targetAlias },
    });
    nextRequestId += 1;
    const readinessResult = getReadinessResult(readiness.payload);
    if (!readiness.ok || readinessResult.ready !== true) {
      const payload = {
        ok: false,
        batchRunId,
        batchId: batch.batchId,
        stage: 'readiness',
        readiness: readiness.payload,
        readinessResult,
      };
      writeJson(path.join(batchRoot, 'summary.json'), payload);
      return payload;
    }

    const batchPreflight = buildBatchPreflight(batch, sendMode, suite.totalCaseCount);
    if (!batchPreflight.ok) {
      const payload = {
        ok: false,
        batchRunId,
        batchId: batch.batchId,
        suiteId: suite.suiteId,
        stage: 'budget_preflight',
        readiness,
        readinessResult,
        exploreLibraryId: exploreLibrary.libraryId,
        selectionSeed: suite.selectionSeed,
        suiteCaseCount: suite.totalCaseCount,
        batchPreflight,
      };
      writeJson(path.join(batchRoot, 'summary.json'), payload);
      return payload;
    }

    const caseResults = [];
    let stopBlocker = null;
    for (let index = 0; index < suite.cases.length; index += 1) {
      const caseDefinition = suite.cases[index];
      if (stopBlocker) {
        caseResults.push(buildBlockedCaseResult(caseDefinition, stopBlocker, index, suite.cases.length));
        continue;
      }
      const loop = await callTool(client, nextRequestId, {
        name: 'desktop_run_conversation_loop',
        arguments: buildCaseLoopArguments({
          targetAlias,
          sendMode,
          observeSeconds,
          pollSeconds,
        }, caseDefinition),
      });
      nextRequestId += 1;
      const loopPayload = loop.payload || {};
      const runId = loopPayload.runId || (loopPayload.result && loopPayload.result.runId) || null;
      const artifactPaths = runId ? deriveArtifactPaths(runId) : { runRoot: null, tracePath: null, resultPath: null };
      const loopVerdict = loopPayload.result && loopPayload.result.evaluatorScores
        ? normalizeText(loopPayload.result.evaluatorScores.verdict)
        : (loop.ok ? 'pass' : 'fail');
      const loopErrorCode = loop.ok
        ? null
        : normalizeText(loopPayload.code || loopPayload.errorCode || (loopPayload.result && loopPayload.result.errorCode));
      const loopError = loop.ok
        ? null
        : normalizeText(loopPayload.error || loopPayload.message || (loopPayload.result && loopPayload.result.error));
      const replyText = extractLatestAssistantReply(loopPayload);
      const replyContract = scoreReplyContract(caseDefinition, replyText);
      const evalRoot = path.join(batchRoot, 'evals');
      const skipEval = shouldSkipEvalForLoopFailure(loop.ok, loopErrorCode);
      const evalResult = skipEval
        ? {
          ok: false,
          skipped: true,
          error: `eval skipped after blocking loop error: ${loopErrorCode || 'unknown'}`,
          mainOutputPath: null,
          planningOutputPath: null,
          mainArtifact: null,
          planningArtifact: null,
        }
        : (
          artifactPaths.tracePath && fs.existsSync(artifactPaths.tracePath)
            ? runDesktopEval(artifactPaths.tracePath, evalRoot, caseDefinition.caseId)
            : {
              ok: false,
              skipped: false,
              error: 'trace_path_missing',
              mainOutputPath: null,
              planningOutputPath: null,
              mainArtifact: null,
              planningArtifact: null,
            }
        );
      const planningProposals = skipEval ? [] : collectPlanningProposals(evalResult.planningArtifact);
      const caseVerdict = loop.ok && loopVerdict === 'pass' && replyContract.verdict === true ? 'pass' : 'fail';
      const promotionResult = skipEval
        ? {
          ok: false,
          status: 'skipped_blocking_error',
          error: `promotion skipped after blocking loop error: ${loopErrorCode || 'unknown'}`,
          proposalIds: [],
        }
        : runPromotionPipeline({
          planningProposals,
          tracePath: evalResult.mainOutputPath ? artifactPaths.tracePath : null,
          planningOutputPath: evalResult.planningOutputPath,
          mainOutputPath: evalResult.mainOutputPath,
          policyRuntime,
          queueRoot: deps && deps.queueRoot ? deps.queueRoot : DEFAULT_QUEUE_ROOT,
          repoRoot: deps && deps.repoRoot ? deps.repoRoot : ROOT,
          baseRef: deps && deps.baseRef ? deps.baseRef : DEFAULT_BASE_REF,
          runner: deps && deps.runner ? deps.runner : spawnSync,
        });
      caseResults.push({
        caseId: caseDefinition.caseId,
        strategicGoal: caseDefinition.strategicGoal,
        improvementAxis: caseDefinition.improvementAxis,
        caseMode: caseDefinition.caseMode || 'core',
        explorationFamily: caseDefinition.explorationFamily || null,
        userInput: caseDefinition.userInput,
        loopOk: loop.ok,
        loopVerdict,
        caseVerdict,
        runId,
        artifactPaths,
        loopPayload,
        loopErrorCode,
        loopError,
        replyContract,
        planningStatus: evalResult.mainArtifact ? normalizeText(evalResult.mainArtifact.planningStatus) : 'unavailable',
        analysisStatus: evalResult.mainArtifact ? normalizeText(evalResult.mainArtifact.analysisStatus) : 'unavailable',
        observationStatus: evalResult.mainArtifact ? normalizeText(evalResult.mainArtifact.observationStatus) : 'unavailable',
        planningProposals,
        promotionResult,
        evalResult,
      });
      if (shouldStopBatchOnErrorCode(loopErrorCode)) {
        stopBlocker = {
          code: loopErrorCode,
          error: loopError || 'batch stopped after a blocking local patrol error',
        };
      }
    }

    const roundSummary = summarizeRound(suite, caseResults);
    const followupSuggestion = buildFollowupSuggestion(caseResults, { targetAlias, sendMode });
    const summary = {
      ok: true,
      batchRunId,
      batchId: batch.batchId,
      suiteId: suite.suiteId,
      batchDescription: batch.description,
      batchPath: batch.path,
      exploreLibraryId: exploreLibrary.libraryId,
      exploreLibraryPath: exploreLibrary.path,
      exploreLibraryDescription: exploreLibrary.description,
      exploreSelectionMode,
      selectionSeed: suite.selectionSeed,
      requestedExploreCaseIds,
      coreCaseCount: suite.coreCaseCount,
      exploreCaseCount: suite.exploreCaseCount,
      totalCaseCount: suite.totalCaseCount,
      selectedExploreCaseIds: suite.selectedExploreCaseIds,
      selectedExploreFamilies: suite.selectedExploreFamilies,
      targetAlias,
      sendMode,
      autoApplyMode: batch.autoApplyMode,
      futureAutomationGoal: batch.futureAutomationGoal,
      policyRuntime: policyRuntime.ok
        ? {
          policyPath: policyRuntime.policyPath,
          proposalMode: policyRuntime.proposalMode,
          autoApplyLevel: policyRuntime.autoApplyLevel,
        }
        : {
          policyPath: policyRuntime.policyPath,
          error: policyRuntime.code,
        },
      readiness,
      readinessResult,
      batchPreflight,
      roundSummary,
      followupSuggestion,
      cases: caseResults.map((result) => ({
        caseId: result.caseId,
        strategicGoal: result.strategicGoal,
        improvementAxis: result.improvementAxis,
        caseMode: result.caseMode,
        explorationFamily: result.explorationFamily,
        caseVerdict: result.caseVerdict,
        loopVerdict: result.loopVerdict,
        loopOk: result.loopOk,
        loopErrorCode: result.loopErrorCode,
        loopError: result.loopError,
        runId: result.runId,
        planningStatus: result.planningStatus,
        analysisStatus: result.analysisStatus,
        observationStatus: result.observationStatus,
        replyContract: result.replyContract,
        planningProposals: result.planningProposals,
        promotionResult: result.promotionResult,
        tracePath: result.artifactPaths.tracePath,
        resultPath: result.artifactPaths.resultPath,
      })),
      nextAction: roundSummary.completionStatus === 'stable_no_improvement_needed'
        ? 'No patch proposal is required for the core-plus-explore suite.'
        : (
          roundSummary.completionStatus === 'promotion_blocked'
            ? 'Review the promotion blockers before any code patch preparation continues.'
            : (
              roundSummary.promotionSummary.patchDraftReadyCount > 0
                ? 'Review the prepared human code edit tasks before any apply_patch step.'
                : 'Review the queued proposals, failing strategic axes, and explore-family misses before any code patch is prepared.'
            )
        ),
    };
    writeJson(path.join(batchRoot, 'summary.json'), summary);
    if (followupSuggestion.focusAvailable) {
      writeJson(path.join(batchRoot, 'focus_followup.json'), followupSuggestion);
    }
    return summary;
  } finally {
    await client.close();
  }
}

async function main(argv) {
  const result = await runStrategicSelfImprovementBatch(argv || process.argv.slice(2));
  const output = JSON.stringify(result, null, 2);
  if (result.ok) {
    process.stdout.write(`${output}\n`);
    return;
  }
  process.stderr.write(`${output}\n`);
  process.exitCode = 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: error && error.message ? error.message : String(error),
    }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildCaseLoopArguments,
  buildFollowupSuggestion,
  buildBatchPreflight,
  buildBlockedCaseResult,
  buildScenarioSuite,
  consecutiveFailureCount,
  extractLatestAssistantReply,
  listRecentTraceArtifacts,
  loadExploreLibrary,
  loadStrategicBatch,
  loadPolicyBudget,
  loadPolicyRuntime,
  parseArgs,
  parseCsvList,
  resolvePolicyPath,
  runEvalProposalQueue,
  runPatchDraftSynthesis,
  runPromotionPipeline,
  runStrategicSelfImprovementBatch,
  scoreReplyContract,
  selectExploreCases,
  selectExploreCasesByIds,
  shouldSkipEvalForLoopFailure,
  shouldStopBatchOnErrorCode,
  summarizeRound,
};
