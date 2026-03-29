'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { resolveAudienceView } = require('../../domain/qualityPatrol/query/resolveAudienceView');
const {
  PROMOTION_APPROVAL_ARTIFACT_ORDER,
  resolvePromotionApprovalStage,
  buildPromotionApprovalNextAction,
  buildPromotionApprovalCommandHints
} = require('../../domain/qualityPatrol/desktopApprovalFlow');

const QUERY_VERSION = 'line_desktop_patrol_summary_v1';
const PROMOTION_REVIEW_DISPLAY_ORDER = Object.freeze([
  { kind: 'code_review_packet', markdownSuffix: '.code_review_packet.md', jsonSuffix: '.code_review_packet.json' },
  { kind: 'code_apply_draft', markdownSuffix: '.code_apply_draft.md', jsonSuffix: '.code_apply_draft.json' },
  { kind: 'code_edit_bundle', markdownSuffix: '.code_edit_bundle.md', jsonSuffix: '.code_edit_bundle.json' },
  { kind: 'code_diff_draft', markdownSuffix: '.code_diff_draft.md', jsonSuffix: '.code_diff_draft.json' },
  { kind: 'code_edit_task', markdownSuffix: '.code_edit_task.md', jsonSuffix: '.code_edit_task.json' },
  { kind: 'code_patch_bundle', markdownSuffix: '.code_patch_bundle.md', jsonSuffix: '.code_patch_bundle.json' },
  { kind: 'patch_request', markdownSuffix: '.patch_request.md', jsonSuffix: '.patch_request.json' },
  { kind: 'patch_draft', markdownSuffix: '.patch_draft.md' },
  { kind: 'draft_pr_body', markdownSuffix: '.draft_pr.md', recordField: 'body_path' }
]);
const PROMOTION_APPROVAL_PROMPT_ORDER = Object.freeze([
  { kind: 'code_apply_task', field: 'worker_prompt_path', markdownSuffix: '.code_apply_task.prompt.md', refKind: 'code_apply_task_prompt' },
  { kind: 'code_apply_signoff', field: 'signoff_prompt_path', markdownSuffix: '.code_apply_signoff.prompt.md', refKind: 'code_apply_signoff_prompt' },
  { kind: 'code_apply_record', field: 'record_prompt_path', markdownSuffix: '.code_apply_record.prompt.md', refKind: 'code_apply_record_prompt' }
]);

function resolveArtifactRoot(deps) {
  const fromDeps = deps && typeof deps.artifactRoot === 'string' ? deps.artifactRoot.trim() : '';
  const fromEnv = typeof process.env.LINE_DESKTOP_PATROL_ARTIFACT_ROOT === 'string'
    ? process.env.LINE_DESKTOP_PATROL_ARTIFACT_ROOT.trim()
    : '';
  const base = fromDeps || fromEnv || path.resolve(__dirname, '..', '..', '..', 'artifacts', 'line_desktop_patrol');
  return path.resolve(base);
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readJsonLinesIfExists(filePath) {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

async function readDirIfExists(dirPath) {
  try {
    return await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

async function latestPromotionRecord(promotionsRoot) {
  const entries = await readDirIfExists(promotionsRoot);
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(promotionsRoot, entry.name));
  const baseRecordFiles = jsonFiles.filter((filePath) => /^[^.]+\.json$/u.test(path.basename(filePath)));
  const files = baseRecordFiles.length ? baseRecordFiles : jsonFiles;
  let latest = null;
  let latestSortKey = 0;
  for (const filePath of files) {
    const payload = await readJsonIfExists(filePath);
    const stat = await statIfExists(filePath);
    const sortKey = resolveSortKey(payload, stat);
    if (sortKey >= latestSortKey) {
      latest = payload ? Object.assign({ __path: filePath, __sortKey: sortKey }, payload) : latest;
      latestSortKey = sortKey;
    }
  }
  return latest;
}

async function latestSelfImprovementSummary(selfImprovementRoot) {
  const entries = await readDirIfExists(selfImprovementRoot);
  let latest = null;
  let latestSortKey = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const summaryPath = path.join(selfImprovementRoot, entry.name, 'summary.json');
    const stat = await statIfExists(summaryPath);
    if (!stat) continue;
    const payload = await readJsonIfExists(summaryPath);
    const sortKey = resolveSortKey(payload, stat);
    if (sortKey >= latestSortKey) {
      latest = payload ? Object.assign({ __path: summaryPath, __sortKey: sortKey }, payload) : latest;
      latestSortKey = sortKey;
    }
  }
  return latest;
}

async function statIfExists(targetPath) {
  try {
    return await fs.promises.stat(targetPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function parseDateMs(value) {
  if (!value) return 0;
  const numeric = Date.parse(String(value));
  return Number.isFinite(numeric) ? numeric : 0;
}

function resolveSortKey(trace, stat) {
  if (trace && typeof trace === 'object') {
    const fromTrace = parseDateMs(
      trace.finished_at
      || trace.finishedAt
      || trace.started_at
      || trace.startedAt
      || null
    );
    if (fromTrace > 0) return fromTrace;
  }
  return stat ? Number(stat.mtimeMs || 0) : 0;
}

function normalizeText(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function resolvePromotionArtifactKind(filePath) {
  const baseName = path.basename(String(filePath || ''), '.json');
  const segments = baseName.split('.');
  if (segments.length >= 2) return normalizeText(segments.slice(1).join('.'), null);
  return normalizeText(baseName, null);
}

function compactDisplayPath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/');
  }
  return filePath.split(path.sep).join('/');
}

function redactedDisplayPath(filePath) {
  const normalized = compactDisplayPath(filePath).split('/').filter(Boolean);
  if (normalized.length <= 3) return normalized.join('/');
  return `.../${normalized.slice(-3).join('/')}`;
}

function toArtifactRef(kind, filePath, audience) {
  return {
    kind,
    displayPath: audience === 'operator' ? compactDisplayPath(filePath) : redactedDisplayPath(filePath),
    path: audience === 'operator' ? filePath : null
  };
}

function normalizeLatestRun(run) {
  if (!run || !run.trace || typeof run.trace !== 'object') return null;
  const trace = run.trace;
  const sendResult = trace.send_result && typeof trace.send_result === 'object' && trace.send_result.result && typeof trace.send_result.result === 'object'
    ? trace.send_result.result
    : {};
  const targetValidation = trace.target_validation && typeof trace.target_validation === 'object'
    ? trace.target_validation
    : {};
  const executionMode = normalizeText(trace.send_mode, null);
  const failureReason = normalizeText(trace.failure_reason || trace.failureReason, null);
  let lastRunKind = 'dry_run';
  if (executionMode === 'execute_once' || executionMode === 'send_only' || executionMode === 'open_target') {
    lastRunKind = 'execute';
  } else if (failureReason && failureReason.endsWith('_stop')) {
    lastRunKind = 'guard_stop';
  }
  return {
    runId: normalizeText(trace.run_id, run.runId),
    scenarioId: normalizeText(trace.scenario_id, null),
    targetId: normalizeText(trace.target_id, null),
    finishedAt: normalizeText(trace.finished_at || trace.finishedAt || trace.started_at || trace.startedAt, null),
    failureReason,
    executionMode,
    sendStatus: normalizeText(sendResult.status, null),
    targetValidationStatus: targetValidation.matched === true
      ? 'matched'
      : normalizeText(targetValidation.reason, null),
    replyObservationStatus: normalizeText(trace.correlation_status, null),
    lastRunKind
  };
}

function normalizeLatestPromotion(record) {
  if (!record || typeof record !== 'object') {
    return {
      latestProposalId: null,
      latestArtifactKind: null,
      latestArtifactStatus: null,
      latestDraftPrRef: null,
      updatedAt: null
    };
  }

  const updatedAt = normalizeText(
    record.updated_at
    || record.updatedAt
    || record.finished_at
    || record.finishedAt
    || record.created_at
    || record.createdAt
    || (record.__sortKey ? new Date(record.__sortKey).toISOString() : null),
    null
  );

  return {
    latestProposalId: normalizeText(record.proposal_id, null),
    latestArtifactKind: normalizeText(record.artifact_kind, null) || resolvePromotionArtifactKind(record.__path),
    latestArtifactStatus: normalizeText(record.status, null),
    latestDraftPrRef: normalizeText(record.draft_pr_ref || record.draft_pr_url, null),
    updatedAt
  };
}

function descriptorForPromotionKind(kind, descriptors) {
  return (Array.isArray(descriptors) ? descriptors : []).find((item) => item && item.kind === kind) || null;
}

async function resolvePromotionArtifactPath(descriptor, record) {
  if (!record || typeof record !== 'object') return null;
  const proposalId = normalizeText(record.proposal_id, null);
  const recordPath = normalizeText(record.__path, null);
  const promotionsRoot = recordPath ? path.dirname(recordPath) : null;
  const candidates = [];

  if (descriptor && descriptor.recordField && record[descriptor.recordField]) {
    candidates.push(path.resolve(String(record[descriptor.recordField])));
  }
  if (promotionsRoot && proposalId) {
    if (descriptor.markdownSuffix) {
      candidates.push(path.join(promotionsRoot, `${proposalId}${descriptor.markdownSuffix}`));
    }
    if (descriptor.jsonSuffix) {
      candidates.push(path.join(promotionsRoot, `${proposalId}${descriptor.jsonSuffix}`));
    }
  }

  const uniqueCandidates = candidates.filter((item, index) => item && candidates.indexOf(item) === index);
  for (const candidate of uniqueCandidates) {
    const stat = await statIfExists(candidate);
    if (stat) {
      return candidate;
    }
  }
  return null;
}

async function resolvePromotionArtifactRef(descriptor, record, audience) {
  const artifactPath = await resolvePromotionArtifactPath(descriptor, record);
  return artifactPath ? toArtifactRef(descriptor.kind, artifactPath, audience) : null;
}

function normalizeUpdatedAtFromPayload(payload, stat) {
  return normalizeText(
    (payload && (
      payload.updated_at
      || payload.updatedAt
      || payload.finished_at
      || payload.finishedAt
      || payload.created_at
      || payload.createdAt
    ))
    || (stat ? new Date(stat.mtimeMs).toISOString() : null),
    null
  );
}

async function resolvePromotionPromptRef(kind, payload, record, audience) {
  const descriptor = descriptorForPromotionKind(kind, PROMOTION_APPROVAL_PROMPT_ORDER);
  if (!descriptor || !record || typeof record !== 'object') return null;

  const candidates = [];
  const proposalId = normalizeText(record.proposal_id, null);
  const recordPath = normalizeText(record.__path, null);
  const promotionsRoot = recordPath ? path.dirname(recordPath) : null;
  if (payload && payload[descriptor.field]) {
    candidates.push(path.resolve(String(payload[descriptor.field])));
  }
  if (promotionsRoot && proposalId && descriptor.markdownSuffix) {
    candidates.push(path.join(promotionsRoot, `${proposalId}${descriptor.markdownSuffix}`));
  }

  for (const candidate of candidates.filter((item, index) => item && candidates.indexOf(item) === index)) {
    const stat = await statIfExists(candidate);
    if (stat) return toArtifactRef(descriptor.refKind, candidate, audience);
  }
  return null;
}

async function normalizeLatestPromotionReview(record, audience) {
  if (!record || typeof record !== 'object') {
    return {
      latestProposalId: null,
      reviewStatus: null,
      latestDraftPrRef: null,
      latestReviewArtifactKind: null,
      latestReviewArtifactRef: null,
      worktreeRef: null,
      branchName: null,
      patchDraftRef: null,
      codeEditTaskRef: null,
      codeApplyDraftRef: null,
      codeReviewPacketRef: null,
      updatedAt: null
    };
  }

  const refsByKind = {};
  for (const descriptor of PROMOTION_REVIEW_DISPLAY_ORDER) {
    const ref = await resolvePromotionArtifactRef(descriptor, record, audience);
    if (ref) refsByKind[descriptor.kind] = ref;
  }
  if (record.__path) {
    refsByKind.promotion_record = toArtifactRef('promotion_record', record.__path, audience);
  }

  const latestReviewArtifactKind = [
    ...PROMOTION_REVIEW_DISPLAY_ORDER.map((descriptor) => descriptor.kind),
    'promotion_record'
  ].find((kind) => refsByKind[kind]) || null;
  const updatedAt = normalizeText(
    record.updated_at
    || record.updatedAt
    || record.finished_at
    || record.finishedAt
    || record.created_at
    || record.createdAt
    || (record.__sortKey ? new Date(record.__sortKey).toISOString() : null),
    null
  );

  return {
    latestProposalId: normalizeText(record.proposal_id, null),
    reviewStatus: normalizeText(record.status, null),
    latestDraftPrRef: normalizeText(record.draft_pr_ref || record.draft_pr_url, null),
    latestReviewArtifactKind,
    latestReviewArtifactRef: latestReviewArtifactKind ? refsByKind[latestReviewArtifactKind] || null : null,
    worktreeRef: normalizeText(record.worktree_path, null)
      ? toArtifactRef('worktree', path.resolve(String(record.worktree_path)), audience)
      : null,
    branchName: normalizeText(record.branch_name, null),
    patchDraftRef: refsByKind.patch_draft || null,
    codeEditTaskRef: refsByKind.code_edit_task || null,
    codeApplyDraftRef: refsByKind.code_apply_draft || null,
    codeReviewPacketRef: refsByKind.code_review_packet || null,
    updatedAt
  };
}

function normalizeStringArray(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeText(String(item || ''), ''))
    .filter(Boolean);
}

function normalizeDisplayList(items, audience) {
  const rows = normalizeStringArray(items);
  return audience === 'operator' ? rows : [];
}

function normalizeCandidateEdits(items, audience) {
  const rows = Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : [];
  return rows.map((item) => ({
    filePath: audience === 'operator'
      ? normalizeText(item.file_path || item.filePath, null)
      : null,
    action: normalizeText(item.action, null),
    rationale: normalizeText(item.rationale, null),
    hiddenForAudience: audience !== 'operator'
  }));
}

function normalizeStatusCounts(items) {
  const counts = {};
  if (!items || typeof items !== 'object') return counts;
  Object.entries(items).forEach(([key, value]) => {
    const label = normalizeText(key, '');
    if (!label) return;
    const numeric = Number(value);
    counts[label] = Number.isFinite(numeric) ? numeric : 0;
  });
  return counts;
}

function normalizeLatestPromotionBatch(record) {
  if (!record || typeof record !== 'object') {
    return {
      batchRunId: null,
      stage: null,
      completionStatus: null,
      queuedProposalCount: 0,
      patchDraftReadyCount: 0,
      blockedCaseIds: [],
      statusCounts: {},
      nextAction: null,
      updatedAt: null
    };
  }

  const roundSummary = record.roundSummary && typeof record.roundSummary === 'object'
    ? record.roundSummary
    : {};
  const promotionSummary = roundSummary.promotionSummary && typeof roundSummary.promotionSummary === 'object'
    ? roundSummary.promotionSummary
    : {};
  const updatedAt = normalizeText(
    record.updated_at
    || record.updatedAt
    || record.generated_at
    || record.generatedAt
    || (record.__sortKey ? new Date(record.__sortKey).toISOString() : null),
    null
  );
  return {
    batchRunId: normalizeText(record.batchRunId, null),
    stage: normalizeText(record.stage, null),
    completionStatus: normalizeText(roundSummary.completionStatus, null),
    queuedProposalCount: Number.isFinite(Number(promotionSummary.queuedProposalCount))
      ? Number(promotionSummary.queuedProposalCount)
      : 0,
    patchDraftReadyCount: Number.isFinite(Number(promotionSummary.patchDraftReadyCount))
      ? Number(promotionSummary.patchDraftReadyCount)
      : 0,
    blockedCaseIds: normalizeStringArray(promotionSummary.blockedCaseIds),
    statusCounts: normalizeStatusCounts(promotionSummary.statusCounts),
    nextAction: normalizeText(record.nextAction, null),
    updatedAt
  };
}

async function normalizeLatestPromotionApproval(record, audience) {
  if (!record || typeof record !== 'object') {
    return {
      latestProposalId: null,
      approvalStage: null,
      approvalStatus: null,
      latestDraftPrRef: null,
      branchName: null,
      worktreeRef: null,
      patchRequestRef: null,
      codeApplyTaskRef: null,
      codeApplySignoffRef: null,
      codeApplyRecordRef: null,
      validationCommands: [],
      validationCommandCount: 0,
      candidateEdits: [],
      candidateEditCount: 0,
      operatorInstructions: [],
      operatorInstructionCount: 0,
      nextCommand: null,
      remainingCommands: [],
      remainingCommandCount: 0,
      nextAction: null,
      updatedAt: null
    };
  }

  const refsByKind = {};
  for (const descriptor of PROMOTION_APPROVAL_ARTIFACT_ORDER) {
    const ref = await resolvePromotionArtifactRef(descriptor, record, audience);
    if (ref) refsByKind[descriptor.kind] = ref;
  }

  const approvalStage = [...PROMOTION_APPROVAL_ARTIFACT_ORDER]
    .reverse()
    .map((descriptor) => descriptor.kind)
    .find((kind) => refsByKind[kind]) || null;
  const patchRequestDescriptor = descriptorForPromotionKind('patch_request', PROMOTION_APPROVAL_ARTIFACT_ORDER);
  const latestDescriptor = descriptorForPromotionKind(approvalStage, PROMOTION_APPROVAL_ARTIFACT_ORDER);
  const patchRequestPath = patchRequestDescriptor
    ? await resolvePromotionArtifactPath(patchRequestDescriptor, record)
    : null;
  const latestApprovalPath = latestDescriptor
    ? await resolvePromotionArtifactPath(latestDescriptor, record)
    : null;
  const latestApprovalStat = latestApprovalPath ? await statIfExists(latestApprovalPath) : null;
  const patchRequestPayload = patchRequestPath ? await readJsonIfExists(patchRequestPath) : null;
  const latestApprovalPayload = latestApprovalPath ? await readJsonIfExists(latestApprovalPath) : null;
  const approvalStatus = normalizeText(
    (latestApprovalPayload && latestApprovalPayload.status)
    || (patchRequestPayload && patchRequestPayload.status)
    || record.status,
    null
  );
  const validationCommands = normalizeStringArray(
    (latestApprovalPayload && latestApprovalPayload.validation_commands)
    || (patchRequestPayload && patchRequestPayload.validation_commands)
  );
  const candidateEdits = normalizeCandidateEdits(
    (patchRequestPayload && patchRequestPayload.candidate_edits) || [],
    audience
  );
  const proposalId = normalizeText(record.proposal_id, null);
  const branchName = normalizeText(record.branch_name, null);
  const worktreePath = normalizeText(record.worktree_path, null);
  const commandHints = buildPromotionApprovalCommandHints(
    approvalStage,
    record.status,
    proposalId,
    branchName,
    worktreePath,
    audience
  );
  const operatorInstructions = normalizeDisplayList(
    (patchRequestPayload && patchRequestPayload.operator_instructions)
    || (latestApprovalPayload && latestApprovalPayload.operator_instructions)
    || [],
    audience
  );
  const latestPromptRef = await resolvePromotionPromptRef(approvalStage, latestApprovalPayload, record, audience);
  const updatedAt = normalizeUpdatedAtFromPayload(latestApprovalPayload, latestApprovalStat)
    || normalizeText(
      record.updated_at
      || record.updatedAt
      || record.finished_at
      || record.finishedAt
      || record.created_at
      || record.createdAt
      || (record.__sortKey ? new Date(record.__sortKey).toISOString() : null),
      null
    );

  return {
    latestProposalId: proposalId,
    approvalStage,
    approvalStatus,
    latestDraftPrRef: normalizeText(record.draft_pr_ref || record.draft_pr_url, null),
    branchName,
    worktreeRef: worktreePath
      ? toArtifactRef('worktree', path.resolve(String(worktreePath)), audience)
      : null,
    latestArtifactRef: approvalStage ? refsByKind[approvalStage] || null : null,
    latestPromptRef,
    patchRequestRef: refsByKind.patch_request || null,
    codeApplyTaskRef: refsByKind.code_apply_task || null,
    codeApplySignoffRef: refsByKind.code_apply_signoff || null,
    codeApplyRecordRef: refsByKind.code_apply_record || null,
    validationCommands: audience === 'operator' ? validationCommands : [],
    validationCommandCount: validationCommands.length,
    candidateEdits,
    candidateEditCount: candidateEdits.length,
    operatorInstructions,
    operatorInstructionCount: normalizeStringArray(
      (patchRequestPayload && patchRequestPayload.operator_instructions)
      || (latestApprovalPayload && latestApprovalPayload.operator_instructions)
      || []
    ).length,
    nextCommand: commandHints.nextCommand,
    remainingCommands: commandHints.remainingCommands,
    remainingCommandCount: commandHints.remainingCommandCount,
    nextAction: buildPromotionApprovalNextAction(approvalStage, approvalStatus),
    updatedAt
  };
}

function summarizeLatestProposalIds(linkage, queueEntries) {
  const ids = [];
  const add = (value) => {
    if (typeof value !== 'string') return;
    const text = value.trim();
    if (!text || ids.includes(text)) return;
    ids.push(text);
  };

  if (linkage && typeof linkage === 'object') {
    (Array.isArray(linkage.queued_proposal_ids) ? linkage.queued_proposal_ids : []).forEach(add);
    (Array.isArray(linkage.duplicate_proposal_ids) ? linkage.duplicate_proposal_ids : []).forEach(add);
  }

  queueEntries.slice(-3).forEach((entry) => {
    if (entry && typeof entry === 'object') add(entry.proposal_id);
  });

  return ids;
}

function buildSummary(status, stage, latestRun, queueCount) {
  if (status === 'error') {
    return 'LINE Desktop Patrol の local artifact 読み込みに失敗しました。';
  }
  if (status === 'unavailable') {
    return 'このホストでは LINE Desktop Patrol の local artifact がまだ観測されていません。';
  }
  if (stage === 'trace_only') {
    return `latest run ${latestRun && latestRun.runId ? latestRun.runId : '-'} の trace はありますが、evaluation と proposal queue はまだありません。`;
  }
  if (stage === 'evaluated') {
    return `latest run ${latestRun && latestRun.runId ? latestRun.runId : '-'} は評価済みです。proposal queue はまだ空です。`;
  }
  if (stage === 'queued') {
    return `latest run ${latestRun && latestRun.runId ? latestRun.runId : '-'} から ${queueCount} 件の proposal が local queue に入っています。`;
  }
  return 'LINE Desktop Patrol の local state を確認してください。';
}

async function listRuns(artifactRoot) {
  const runsRoot = path.join(artifactRoot, 'runs');
  const entries = await readDirIfExists(runsRoot);
  const runs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runId = entry.name;
    const runRoot = path.join(runsRoot, runId);
    const tracePath = path.join(runRoot, 'trace.json');
    const trace = await readJsonIfExists(tracePath);
    if (!trace || typeof trace !== 'object') continue;
    const linkagePath = path.join(runRoot, 'proposal_linkage.json');
    const evalPath = path.join(artifactRoot, 'evals', runId, 'desktop_patrol_eval.json');
    const stat = await statIfExists(runRoot);
    runs.push({
      runId,
      runRoot,
      sortKey: resolveSortKey(trace, stat),
      tracePath,
      trace,
      linkagePath,
      linkage: await readJsonIfExists(linkagePath),
      evalPath,
      evaluation: await readJsonIfExists(evalPath)
    });
  }

  runs.sort((left, right) => {
    if (right.sortKey !== left.sortKey) return right.sortKey - left.sortKey;
    return String(right.runId).localeCompare(String(left.runId), 'ja');
  });
  return runs;
}

async function listPacketPaths(packetRoot) {
  const entries = await readDirIfExists(packetRoot);
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.codex.json'))
    .map((entry) => path.join(packetRoot, entry.name))
    .sort((left, right) => left.localeCompare(right, 'ja'));
}

async function queryLatestDesktopPatrolSummary(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const artifactRoot = resolveArtifactRoot(deps);

  try {
    const runs = await listRuns(artifactRoot);
    const latestRunRecord = runs[0] || null;
    const latestRun = normalizeLatestRun(latestRunRecord);
    const queuePath = path.join(artifactRoot, 'proposals', 'queue.jsonl');
    const queueEntries = await readJsonLinesIfExists(queuePath);
    const latestQueueEntry = queueEntries.length ? queueEntries[queueEntries.length - 1] : null;
    const packetRoot = path.join(artifactRoot, 'proposals', 'packets');
    const packetPaths = await listPacketPaths(packetRoot);
    const latestPromotion = await latestPromotionRecord(path.join(artifactRoot, 'proposals', 'promotions'));
    const promotion = normalizeLatestPromotion(latestPromotion);
    const promotionReview = await normalizeLatestPromotionReview(latestPromotion, audience);
    const promotionApproval = await normalizeLatestPromotionApproval(latestPromotion, audience);
    const latestPromotionBatchRecord = await latestSelfImprovementSummary(
      path.join(artifactRoot, 'self_improvement_runs')
    );
    const promotionBatch = normalizeLatestPromotionBatch(latestPromotionBatchRecord);
    const latestDraftPrRef = promotion.latestDraftPrRef || (latestQueueEntry && typeof latestQueueEntry === 'object'
      ? normalizeText(latestQueueEntry.draft_pr_ref, null)
      : null);
    const latestProposalIds = summarizeLatestProposalIds(
      latestRunRecord ? latestRunRecord.linkage : null,
      queueEntries
    );
    const queueCount = queueEntries.length;
    const hasEvaluation = Boolean(latestRunRecord && latestRunRecord.evaluation);

    let status = 'unavailable';
    let stage = 'not_observed';
    if (queueCount > 0) {
      status = 'ready';
      stage = 'queued';
    } else if (hasEvaluation) {
      status = 'ready';
      stage = 'evaluated';
    } else if (latestRun) {
      status = 'insufficient_evidence';
      stage = 'trace_only';
    }

    const artifactRefs = [];
    if (latestRunRecord && latestRunRecord.tracePath) artifactRefs.push(toArtifactRef('trace', latestRunRecord.tracePath, audience));
    if (latestRunRecord && latestRunRecord.evalPath && latestRunRecord.evaluation) {
      artifactRefs.push(toArtifactRef('evaluation', latestRunRecord.evalPath, audience));
    }
    if (latestRunRecord && latestRunRecord.linkagePath && latestRunRecord.linkage) {
      artifactRefs.push(toArtifactRef('proposal_linkage', latestRunRecord.linkagePath, audience));
    }
    if (queueCount > 0) artifactRefs.push(toArtifactRef('proposal_queue', queuePath, audience));
    if (packetPaths.length > 0) artifactRefs.push(toArtifactRef('codex_packet', packetPaths[packetPaths.length - 1], audience));
    if (latestPromotion && latestPromotion.__path) artifactRefs.push(toArtifactRef('promotion', latestPromotion.__path, audience));
    if (latestPromotionBatchRecord && latestPromotionBatchRecord.__path) {
      artifactRefs.push(toArtifactRef('promotion_batch_summary', latestPromotionBatchRecord.__path, audience));
    }

    const evaluation = latestRunRecord && latestRunRecord.evaluation && typeof latestRunRecord.evaluation === 'object'
      ? {
        planningStatus: normalizeText(latestRunRecord.evaluation.planningStatus, 'unavailable'),
        analysisStatus: normalizeText(latestRunRecord.evaluation.analysisStatus, 'unavailable'),
        observationStatus: normalizeText(latestRunRecord.evaluation.observationStatus, 'unavailable')
      }
      : {
        planningStatus: 'unavailable',
        analysisStatus: 'unavailable',
        observationStatus: 'unavailable'
      };

    return {
      ok: true,
      queryVersion: QUERY_VERSION,
      audience,
      generatedAt: new Date().toISOString(),
      artifactRoot: audience === 'operator' ? artifactRoot : null,
      status,
      stage,
      summary: buildSummary(status, stage, latestRun, queueCount),
      latestRun,
      evaluation,
      queue: {
        totalCount: queueCount,
        latestProposalId: latestQueueEntry && typeof latestQueueEntry === 'object'
          ? normalizeText(latestQueueEntry.proposal_id, null)
          : null,
        packetCount: packetPaths.length,
        latestDraftPrRef
      },
      promotion,
      promotionReview,
      promotionApproval,
      promotionBatch,
      latestProposalIds,
      artifactRefs
    };
  } catch (error) {
    return {
      ok: false,
      queryVersion: QUERY_VERSION,
      audience,
      generatedAt: new Date().toISOString(),
      artifactRoot: audience === 'operator' ? artifactRoot : null,
      status: 'error',
      stage: 'error',
      summary: buildSummary('error', 'error', null, 0),
      error: error && error.message ? error.message : String(error),
      latestRun: null,
      evaluation: {
        planningStatus: 'error',
        analysisStatus: 'error',
        observationStatus: 'error'
      },
      queue: {
        totalCount: 0,
        latestProposalId: null,
        packetCount: 0,
        latestDraftPrRef: null
      },
      promotion: {
        latestProposalId: null,
        latestArtifactKind: null,
        latestArtifactStatus: null,
        latestDraftPrRef: null,
        updatedAt: null
      },
      promotionReview: {
        latestProposalId: null,
        reviewStatus: null,
        latestDraftPrRef: null,
        latestReviewArtifactKind: null,
        latestReviewArtifactRef: null,
        worktreeRef: null,
        branchName: null,
        patchDraftRef: null,
        codeEditTaskRef: null,
        codeApplyDraftRef: null,
        codeReviewPacketRef: null,
        updatedAt: null
      },
      promotionApproval: {
        latestProposalId: null,
        approvalStage: null,
        approvalStatus: null,
        latestDraftPrRef: null,
        branchName: null,
        worktreeRef: null,
        latestArtifactRef: null,
        latestPromptRef: null,
        patchRequestRef: null,
        codeApplyTaskRef: null,
        codeApplySignoffRef: null,
        codeApplyRecordRef: null,
        validationCommands: [],
        validationCommandCount: 0,
        candidateEdits: [],
        candidateEditCount: 0,
        operatorInstructions: [],
        operatorInstructionCount: 0,
        nextAction: null,
        updatedAt: null
      },
      promotionBatch: {
        batchRunId: null,
        stage: null,
        completionStatus: null,
        queuedProposalCount: 0,
        patchDraftReadyCount: 0,
        blockedCaseIds: [],
        statusCounts: {},
        nextAction: null,
        updatedAt: null
      },
      latestProposalIds: [],
      artifactRefs: []
    };
  }
}

module.exports = {
  queryLatestDesktopPatrolSummary
};
