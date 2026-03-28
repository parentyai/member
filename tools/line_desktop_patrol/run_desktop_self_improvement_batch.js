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
  const normalizedCases = cases.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`case ${index} must be an object`);
    }
    const replyContract = item.reply_contract;
    if (!replyContract || typeof replyContract !== 'object') {
      throw new Error(`case ${index} reply_contract is required`);
    }
    const mustIncludeAny = Array.isArray(replyContract.must_include_any)
      ? replyContract.must_include_any.map((row) => normalizeText(String(row))).filter(Boolean)
      : [];
    if (mustIncludeAny.length === 0) {
      throw new Error(`case ${index} must include reply_contract.must_include_any`);
    }
    return {
      caseId: requireString(item.case_id, `cases[${index}].case_id`),
      strategicGoal: requireString(item.strategic_goal, `cases[${index}].strategic_goal`),
      improvementAxis: requireString(item.improvement_axis, `cases[${index}].improvement_axis`),
      userInput: requireString(item.user_input, `cases[${index}].user_input`),
      expectedReplySubstrings: (Array.isArray(item.expected_reply_substrings) ? item.expected_reply_substrings : [])
        .map((row) => normalizeText(String(row)))
        .filter(Boolean),
      forbiddenReplySubstrings: (Array.isArray(item.forbidden_reply_substrings) ? item.forbidden_reply_substrings : [])
        .map((row) => normalizeText(String(row)))
        .filter(Boolean),
      replyContract: {
        mustIncludeAny,
        maxLines: toInt(replyContract.max_lines, 2),
        maxChars: toInt(replyContract.max_chars, 90),
        disallowQuestion: replyContract.disallow_question === true,
      },
    };
  });

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

function summarizeRound(batch, caseResults) {
  const strategicAxes = {};
  const proposals = [];
  let passCount = 0;
  let replyContractPassCount = 0;
  let loopPassCount = 0;
  let proposalCount = 0;
  const failingCaseIds = [];
  for (const result of caseResults) {
    strategicAxes[result.improvementAxis] = strategicAxes[result.improvementAxis] || { total: 0, passed: 0 };
    strategicAxes[result.improvementAxis].total += 1;
    if (result.loopVerdict === 'pass') loopPassCount += 1;
    if (result.replyContract && result.replyContract.verdict === true) replyContractPassCount += 1;
    if (result.caseVerdict === 'pass') {
      passCount += 1;
      strategicAxes[result.improvementAxis].passed += 1;
    } else {
      failingCaseIds.push(result.caseId);
    }
    for (const proposal of result.planningProposals) {
      proposalCount += 1;
      proposals.push(Object.assign({ caseId: result.caseId }, proposal));
    }
  }
  return {
    batchId: batch.batchId,
    fixedCaseCount: batch.fixedCaseCount,
    passCount,
    loopPassCount,
    replyContractPassCount,
    failCount: caseResults.length - passCount,
    proposalCount,
    failingCaseIds,
    strategicAxes,
    proposals,
    completionStatus: passCount === batch.fixedCaseCount && proposalCount === 0
      ? 'stable_no_improvement_needed'
      : 'proposal_review_required',
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
  const targetAlias = requireString(args.targetAlias, 'targetAlias');
  const sendMode = normalizeText(args.sendMode) || 'execute';
  const observeSeconds = toInt(args.observeSeconds, 25);
  const pollSeconds = toInt(args.pollSeconds, 2);
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

    const caseResults = [];
    for (const caseDefinition of batch.cases) {
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
      const replyText = extractLatestAssistantReply(loopPayload);
      const replyContract = scoreReplyContract(caseDefinition, replyText);
      const evalRoot = path.join(batchRoot, 'evals');
      const evalResult = artifactPaths.tracePath && fs.existsSync(artifactPaths.tracePath)
        ? runDesktopEval(artifactPaths.tracePath, evalRoot, caseDefinition.caseId)
        : {
          ok: false,
          error: 'trace_path_missing',
          mainOutputPath: null,
          planningOutputPath: null,
          mainArtifact: null,
          planningArtifact: null,
        };
      const planningProposals = collectPlanningProposals(evalResult.planningArtifact);
      const loopVerdict = loopPayload.result && loopPayload.result.evaluatorScores
        ? normalizeText(loopPayload.result.evaluatorScores.verdict)
        : (loop.ok ? 'pass' : 'fail');
      const caseVerdict = loop.ok && loopVerdict === 'pass' && replyContract.verdict === true ? 'pass' : 'fail';
      caseResults.push({
        caseId: caseDefinition.caseId,
        strategicGoal: caseDefinition.strategicGoal,
        improvementAxis: caseDefinition.improvementAxis,
        userInput: caseDefinition.userInput,
        loopOk: loop.ok,
        loopVerdict,
        caseVerdict,
        runId,
        artifactPaths,
        loopPayload,
        replyContract,
        planningStatus: evalResult.mainArtifact ? normalizeText(evalResult.mainArtifact.planningStatus) : 'unavailable',
        analysisStatus: evalResult.mainArtifact ? normalizeText(evalResult.mainArtifact.analysisStatus) : 'unavailable',
        observationStatus: evalResult.mainArtifact ? normalizeText(evalResult.mainArtifact.observationStatus) : 'unavailable',
        planningProposals,
        evalResult,
      });
    }

    const roundSummary = summarizeRound(batch, caseResults);
    const summary = {
      ok: true,
      batchRunId,
      batchId: batch.batchId,
      batchDescription: batch.description,
      targetAlias,
      sendMode,
      autoApplyMode: batch.autoApplyMode,
      futureAutomationGoal: batch.futureAutomationGoal,
      readiness,
      readinessResult,
      roundSummary,
      cases: caseResults.map((result) => ({
        caseId: result.caseId,
        strategicGoal: result.strategicGoal,
        improvementAxis: result.improvementAxis,
        caseVerdict: result.caseVerdict,
        loopVerdict: result.loopVerdict,
        runId: result.runId,
        planningStatus: result.planningStatus,
        analysisStatus: result.analysisStatus,
        observationStatus: result.observationStatus,
        replyContract: result.replyContract,
        planningProposals: result.planningProposals,
        tracePath: result.artifactPaths.tracePath,
        resultPath: result.artifactPaths.resultPath,
      })),
      nextAction: roundSummary.completionStatus === 'stable_no_improvement_needed'
        ? 'No patch proposal is required for this fixed batch.'
        : 'Review the aggregated proposals before any code patch is auto-applied.',
    };
    writeJson(path.join(batchRoot, 'summary.json'), summary);
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
  extractLatestAssistantReply,
  loadStrategicBatch,
  parseArgs,
  runStrategicSelfImprovementBatch,
  scoreReplyContract,
  summarizeRound,
};
