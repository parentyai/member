'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SWIFT_SCRIPT = path.join(__dirname, 'desktop_ui_bridge.swift');

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function parseMultiFlag(argv, flag) {
  const out = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === flag && typeof argv[index + 1] === 'string') {
      out.push(argv[index + 1]);
      index += 1;
    }
  }
  return out;
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
  args.expectedReplySubstrings = parseMultiFlag(argv, '--expected-reply-substring');
  args.forbiddenReplySubstrings = parseMultiFlag(argv, '--forbidden-reply-substring');
  return args;
}

function normalizeTranscript(text) {
  return String(text || '').replace(/\r/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
}

function extractBridgeErrorText(error) {
  if (!error || typeof error !== 'object') return '';
  return [
    normalizeText(typeof error.stdout === 'string' ? error.stdout : ''),
    normalizeText(typeof error.stderr === 'string' ? error.stderr : ''),
    normalizeText(typeof error.message === 'string' ? error.message : ''),
  ].filter(Boolean).join('\n');
}

function detectBridgeFailureCode(rawText) {
  const normalized = normalizeText(String(rawText || '')).toLowerCase();
  if (!normalized) return 'desktop_ui_failed';
  if (normalized.includes('session_logged_out') || normalized.includes('desktop_session_logged_out')) {
    return 'desktop_session_logged_out';
  }
  return 'desktop_ui_failed';
}

function toVisibleEntries(text) {
  return normalizeTranscript(text).map((line) => ({ role: 'visible_text', text: line }));
}

function extractAppendedLines(beforeText, afterText) {
  const before = normalizeTranscript(beforeText);
  const after = normalizeTranscript(afterText);
  let pivot = 0;
  while (pivot < before.length && pivot < after.length && before[pivot] === after[pivot]) {
    pivot += 1;
  }
  return after.slice(pivot);
}

function evaluateConversationLoop(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const expectedReplySubstrings = Array.isArray(payload.expectedReplySubstrings) ? payload.expectedReplySubstrings.filter(Boolean) : [];
  const forbiddenReplySubstrings = Array.isArray(payload.forbiddenReplySubstrings) ? payload.forbiddenReplySubstrings.filter(Boolean) : [];
  const sentText = String(payload.sentText || '');
  const beforeTranscript = String(payload.beforeTranscript || '');
  const afterSendTranscript = String(payload.afterSendTranscript || '');
  const finalTranscript = String(payload.finalTranscript || '');
  const replyObserved = payload.replyObserved === true;
  const sendMode = String(payload.sendMode || 'execute');

  const finalLines = normalizeTranscript(finalTranscript);
  const replyLines = extractAppendedLines(afterSendTranscript, finalTranscript);
  const replyJoined = replyLines.join('\n');
  const evaluationText = sendMode === 'dry_run' ? finalTranscript : replyJoined;
  const sentVisible = sentText.length > 0 && (afterSendTranscript.includes(sentText) || finalTranscript.includes(sentText));
  const expectedReplyMatched = sendMode === 'dry_run'
    ? true
    : expectedReplySubstrings.length === 0
      ? replyObserved
      : expectedReplySubstrings.some((item) => evaluationText.includes(item));
  const forbiddenReplyHit = forbiddenReplySubstrings.some((item) => evaluationText.includes(item));
  const transcriptChanged = beforeTranscript !== finalTranscript;
  const verdict = (payload.targetMatchedHeuristic === true)
    && (sendMode === 'dry_run' || sentVisible)
    && (sendMode === 'dry_run' || replyObserved)
    && expectedReplyMatched
    && !forbiddenReplyHit;

  return {
    transport: 'line_desktop_user_account',
    sendMode,
    targetMatchedHeuristic: payload.targetMatchedHeuristic === true,
    searchQueryApplied: payload.searchQueryApplied === true,
    transcriptChanged,
    sentVisible,
    replyObserved,
    replyAppendedLineCount: replyLines.length,
    expectedReplyMatched,
    forbiddenReplyHit,
    finalVisibleLineCount: finalLines.length,
    verdict: verdict ? 'pass' : 'fail',
  };
}

function buildDesktopProposal(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const scores = payload.evaluatorScores && typeof payload.evaluatorScores === 'object' ? payload.evaluatorScores : {};
  if (scores.verdict !== 'fail') return null;
  let rootCauseCategory = 'operator_followup';
  if (scores.targetMatchedHeuristic === false) rootCauseCategory = 'observation_gap';
  else if (scores.replyObserved === false) rootCauseCategory = 'operator_followup';
  else if (scores.forbiddenReplyHit === true) rootCauseCategory = 'policy_gap';
  else if (scores.expectedReplyMatched === false) rootCauseCategory = 'routing_gap';

  return {
    proposal_id: `desktop-proposal-${payload.runId || Date.now()}`,
    source_trace_ids: [String(payload.runId || 'unknown-run')],
    root_cause_category: rootCauseCategory,
    proposed_change_scope: 'eval',
    affected_files: [
      'tools/line_desktop_patrol/desktop_ui_bridge.js',
      'tools/line_desktop_patrol/desktop_ui_bridge.swift'
    ],
    expected_score_delta: 0.15,
    risk_level: 'low',
    requires_human_review: true,
  };
}

function ensureRunArtifactsDir(runId) {
  const runDir = path.join(ROOT, 'artifacts', 'line_desktop_patrol', 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
}

function runSwiftBridge(command, payload, deps) {
  const explicitDeps = deps && typeof deps === 'object' ? deps : {};
  const execImpl = typeof explicitDeps.execFileSync === 'function' ? explicitDeps.execFileSync : execFileSync;
  let raw;
  try {
    raw = execImpl('swift', [SWIFT_SCRIPT, command], {
      cwd: ROOT,
      encoding: 'utf8',
      input: JSON.stringify(payload),
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    const rawText = extractBridgeErrorText(error);
    return {
      ok: false,
      errorCode: detectBridgeFailureCode(rawText),
      error: rawText || 'desktop_ui_failed',
    };
  }
  return JSON.parse(String(raw || '{}'));
}

function runDesktopSnapshot(args, deps) {
  const payload = args && typeof args === 'object' ? args : {};
  const runId = ensureString(payload.runId || `desktop-snapshot-${Date.now()}`, 'runId');
  const runDir = ensureRunArtifactsDir(runId);
  const result = runSwiftBridge('snapshot', {
    expectedChatTitle: ensureString(payload.expectedChatTitle, 'expectedChatTitle'),
    screenshotBeforePath: payload.storeScreenshots === true ? path.join(runDir, 'ui_before.png') : null,
  }, deps);
  if (result.ok !== true) {
    return {
      ok: false,
      runId,
      transport: 'line_desktop_user_account',
      expectedChatTitle: payload.expectedChatTitle || null,
      targetSelectionAttempted: false,
      targetMatchedHeuristic: false,
      searchQueryApplied: false,
      sidebarVisibleRows: 0,
      selectedRowIndex: null,
      headerTextObserved: [],
      windowTitle: '',
      windowFrame: null,
      transcriptBefore: '',
      transcriptAfterSend: '',
      transcriptAfterReply: '',
      visibleBefore: [],
      visibleAfter: [],
      replyObserved: false,
      screenshotBeforePath: null,
      screenshotAfterPath: null,
      errorCode: typeof result.errorCode === 'string' ? result.errorCode : 'desktop_ui_failed',
      error: typeof result.error === 'string' ? result.error : 'desktop_ui_failed',
    };
  }
  return Object.assign({}, result, {
    ok: result.ok === true,
    runId,
    visibleBefore: toVisibleEntries(result.transcriptBefore),
    visibleAfter: toVisibleEntries(result.transcriptAfterReply),
  });
}

function runDesktopReadiness(args, deps) {
  const payload = args && typeof args === 'object' ? args : {};
  const result = runSwiftBridge('readiness', {
    expectedChatTitle: typeof payload.expectedChatTitle === 'string' ? payload.expectedChatTitle : null,
  }, deps);
  const readinessErrorCode = typeof result.errorCode === 'string'
    ? result.errorCode
    : (typeof result.error === 'string' ? detectBridgeFailureCode(result.error) : null);
  if (result.ok !== true) {
    return {
      ok: true,
      ready: false,
      transport: 'line_desktop_user_account',
      accessibilityTrusted: true,
      lineRunning: true,
      contextResolved: false,
      expectedChatTitle: typeof payload.expectedChatTitle === 'string' ? payload.expectedChatTitle : null,
      expectedTitleMatched: null,
      targetSelectionAttempted: null,
      targetMatchedHeuristic: null,
      searchQueryApplied: null,
      sidebarVisibleRows: null,
      headerTextObserved: [],
      windowTitle: null,
      windowFrame: null,
      selectedRowIndex: null,
      errorCode: readinessErrorCode || 'desktop_ui_failed',
      error: readinessErrorCode || (typeof result.error === 'string' ? result.error : 'desktop_ui_failed'),
    };
  }
  return {
    ok: result.ok === true,
    ready: result.ready === true,
    transport: String(result.transport || 'line_desktop_user_account'),
    accessibilityTrusted: result.accessibilityTrusted === true,
    lineRunning: result.lineRunning === true,
    contextResolved: result.contextResolved === true,
    expectedChatTitle: typeof result.expectedChatTitle === 'string' ? result.expectedChatTitle : null,
    expectedTitleMatched: typeof result.expectedTitleMatched === 'boolean' ? result.expectedTitleMatched : null,
    targetSelectionAttempted: typeof result.targetSelectionAttempted === 'boolean' ? result.targetSelectionAttempted : null,
    targetMatchedHeuristic: typeof result.targetMatchedHeuristic === 'boolean' ? result.targetMatchedHeuristic : null,
    searchQueryApplied: typeof result.searchQueryApplied === 'boolean' ? result.searchQueryApplied : null,
    sidebarVisibleRows: Number.isInteger(result.sidebarVisibleRows) ? result.sidebarVisibleRows : null,
    headerTextObserved: Array.isArray(result.headerTextObserved) ? result.headerTextObserved : [],
    windowTitle: typeof result.windowTitle === 'string' ? result.windowTitle : null,
    windowFrame: result.windowFrame || null,
    selectedRowIndex: Number.isInteger(result.selectedRowIndex) ? result.selectedRowIndex : null,
    errorCode: readinessErrorCode,
    error: typeof result.error === 'string' ? result.error : null,
  };
}

function runDesktopConversationLoop(args, deps) {
  const payload = args && typeof args === 'object' ? args : {};
  const runId = ensureString(payload.runId || `desktop-loop-${Date.now()}`, 'runId');
  const expectedChatTitle = ensureString(payload.expectedChatTitle, 'expectedChatTitle');
  const sendMode = payload.sendMode === 'dry_run' ? 'dry_run' : 'execute';
  const runDir = ensureRunArtifactsDir(runId);
  const swiftResult = runSwiftBridge('conversation-loop', {
    expectedChatTitle,
    text: sendMode === 'dry_run' ? '' : ensureString(payload.text, 'text'),
    sendMode,
    observeSeconds: toInt(payload.observeSeconds, 20),
    pollSeconds: toInt(payload.pollSeconds, 2),
    screenshotBeforePath: payload.storeScreenshots === true ? path.join(runDir, 'ui_before.png') : null,
    screenshotAfterPath: payload.storeScreenshots === true ? path.join(runDir, 'ui_after.png') : null,
  }, deps);
  if (swiftResult.ok !== true) {
    const loopErrorCode = typeof swiftResult.errorCode === 'string'
      ? swiftResult.errorCode
      : detectBridgeFailureCode(swiftResult.error);
    return {
      ok: false,
      runId,
      mode: sendMode,
      transport: 'line_desktop_user_account',
      expectedChatTitle,
      targetMatchedHeuristic: false,
      searchQueryApplied: false,
      sidebarVisibleRows: 0,
      selectedRowIndex: null,
      headerTextObserved: [],
      windowTitle: '',
      windowFrame: null,
      transcriptBefore: '',
      transcriptAfterSend: '',
      transcriptAfterReply: '',
      visibleBefore: [],
      visibleAfter: [],
      replyObserved: false,
      screenshotBeforePath: null,
      screenshotAfterPath: null,
      evaluatorScores: {
        transport: 'line_desktop_user_account',
        sendMode,
        targetMatchedHeuristic: false,
        searchQueryApplied: false,
        transcriptChanged: false,
        sentVisible: false,
        replyObserved: false,
        replyAppendedLineCount: 0,
        expectedReplyMatched: false,
        forbiddenReplyHit: false,
        finalVisibleLineCount: 0,
        verdict: 'fail',
      },
      proposal: null,
      errorCode: loopErrorCode,
      error: typeof swiftResult.error === 'string' ? swiftResult.error : 'desktop_ui_failed',
    };
  }

  const evaluatorScores = evaluateConversationLoop({
    sendMode,
    targetMatchedHeuristic: swiftResult.targetMatchedHeuristic,
    searchQueryApplied: swiftResult.searchQueryApplied,
    sentText: payload.text,
    beforeTranscript: swiftResult.transcriptBefore,
    afterSendTranscript: swiftResult.transcriptAfterSend,
    finalTranscript: swiftResult.transcriptAfterReply,
    replyObserved: swiftResult.replyObserved,
    expectedReplySubstrings: payload.expectedReplySubstrings,
    forbiddenReplySubstrings: payload.forbiddenReplySubstrings,
  });
  const proposal = buildDesktopProposal({
    runId,
    evaluatorScores,
  });

  return {
    ok: swiftResult.ok === true,
    runId,
    mode: sendMode,
    transport: 'line_desktop_user_account',
    expectedChatTitle,
    targetMatchedHeuristic: swiftResult.targetMatchedHeuristic === true,
    searchQueryApplied: swiftResult.searchQueryApplied === true,
    sidebarVisibleRows: Number(swiftResult.sidebarVisibleRows || 0),
    selectedRowIndex: Number.isInteger(swiftResult.selectedRowIndex) ? swiftResult.selectedRowIndex : null,
    headerTextObserved: Array.isArray(swiftResult.headerTextObserved) ? swiftResult.headerTextObserved : [],
    windowTitle: String(swiftResult.windowTitle || ''),
    windowFrame: swiftResult.windowFrame || null,
    transcriptBefore: String(swiftResult.transcriptBefore || ''),
    transcriptAfterSend: String(swiftResult.transcriptAfterSend || ''),
    transcriptAfterReply: String(swiftResult.transcriptAfterReply || ''),
    visibleBefore: toVisibleEntries(swiftResult.transcriptBefore),
    visibleAfter: toVisibleEntries(swiftResult.transcriptAfterReply),
    replyObserved: swiftResult.replyObserved === true,
    screenshotBeforePath: swiftResult.screenshotBeforePath || null,
    screenshotAfterPath: swiftResult.screenshotAfterPath || null,
    evaluatorScores,
    proposal,
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const command = args._[0] || 'conversation-loop';
  let result;
  if (command === 'snapshot') {
    result = runDesktopSnapshot({
      runId: args.runId,
      expectedChatTitle: args.expectedChatTitle,
      storeScreenshots: args.storeScreenshots === true,
    });
  } else if (command === 'readiness') {
    result = runDesktopReadiness({
      expectedChatTitle: args.expectedChatTitle,
    });
  } else if (command === 'conversation-loop') {
    result = runDesktopConversationLoop({
      runId: args.runId,
      expectedChatTitle: args.expectedChatTitle,
      text: args.text,
      sendMode: args.sendMode,
      observeSeconds: args.observeSeconds,
      pollSeconds: args.pollSeconds,
      expectedReplySubstrings: args.expectedReplySubstrings,
      forbiddenReplySubstrings: args.forbiddenReplySubstrings,
      storeScreenshots: args.storeScreenshots === true,
    });
  } else {
    throw new Error(`unsupported command: ${command}`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: error && error.message ? error.message : String(error),
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  SWIFT_SCRIPT,
  buildDesktopProposal,
  detectBridgeFailureCode,
  evaluateConversationLoop,
  extractBridgeErrorText,
  extractAppendedLines,
  normalizeTranscript,
  normalizeText,
  parseArgs,
  runDesktopConversationLoop,
  runDesktopReadiness,
  runDesktopSnapshot,
  runSwiftBridge,
  toVisibleEntries,
};
