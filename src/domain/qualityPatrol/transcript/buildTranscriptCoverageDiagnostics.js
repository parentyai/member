'use strict';

const TRANSCRIPT_SNAPSHOT_OUTCOME_KEYS = Object.freeze([
  'written',
  'skipped_flag_disabled',
  'skipped_missing_line_user_key',
  'skipped_unreviewable_transcript',
  'failed_repo_write',
  'failed_unknown'
]);

const TRANSCRIPT_SNAPSHOT_BUILD_SKIPPED_REASON_KEYS = Object.freeze([
  'feature_flag_off',
  'line_user_key_missing',
  'assistant_reply_missing',
  'sanitized_reply_empty',
  'masking_removed_text',
  'region_prompt_fallback'
]);

function normalizeOutcome(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return TRANSCRIPT_SNAPSHOT_OUTCOME_KEYS.includes(normalized) ? normalized : null;
}

function normalizeReason(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return normalized || null;
}

function normalizeSnapshotBuildSkippedReason(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return TRANSCRIPT_SNAPSHOT_BUILD_SKIPPED_REASON_KEYS.includes(normalized) ? normalized : null;
}

function normalizeTranscriptSnapshotBuildSkippedReason(value) {
  return normalizeSnapshotBuildSkippedReason(value);
}

function createOutcomeCounts() {
  return TRANSCRIPT_SNAPSHOT_OUTCOME_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

function createSkippedReasonCounts() {
  return TRANSCRIPT_SNAPSHOT_BUILD_SKIPPED_REASON_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

function createLengthStats() {
  return {
    observedCount: 0,
    min: null,
    max: null,
    avg: 0
  };
}

function createSnapshotInputDiagnostics() {
  return {
    assistantReplyPresent: {
      trueCount: 0,
      falseCount: 0
    },
    assistantReplyLength: createLengthStats(),
    sanitizedReplyLength: createLengthStats(),
    snapshotBuildAttempted: {
      trueCount: 0,
      falseCount: 0
    },
    snapshotBuildSkippedReason: createSkippedReasonCounts()
  };
}

function sortObject(input) {
  return Object.fromEntries(
    Object.entries(input && typeof input === 'object' ? input : {})
      .filter((entry) => entry[1] > 0)
      .sort((left, right) => left[0].localeCompare(right[0], 'ja'))
  );
}

function resolveTranscriptCoverageStatus(counts, observedCount) {
  const rows = counts && typeof counts === 'object' ? counts : {};
  const writtenCount = Number(rows.written || 0);
  const failureCount = Number(rows.failed_repo_write || 0) + Number(rows.failed_unknown || 0);
  if (observedCount <= 0) return 'unavailable';
  if (writtenCount > 0 && failureCount <= 0) return 'ready';
  if (writtenCount > 0) return 'warn';
  return 'blocked';
}

function recordBooleanCounts(target, value) {
  if (value === true) target.trueCount += 1;
  else if (value === false) target.falseCount += 1;
}

function recordLengthStat(target, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return;
  const sanitized = Math.max(0, Math.floor(numeric));
  target.observedCount += 1;
  target.min = target.min === null ? sanitized : Math.min(target.min, sanitized);
  target.max = target.max === null ? sanitized : Math.max(target.max, sanitized);
  target.avg = Math.round((((target.avg * (target.observedCount - 1)) + sanitized) / target.observedCount) * 10000) / 10000;
}

function createEmptyTranscriptCoverageDiagnostics() {
  const transcriptWriteOutcomeCounts = createOutcomeCounts();
  return {
    observedCount: 0,
    writtenCount: 0,
    skippedCount: 0,
    failedCount: 0,
    transcriptWriteOutcomeCounts,
    transcriptWriteFailureReasons: {},
    snapshotInputDiagnostics: createSnapshotInputDiagnostics(),
    transcriptCoverageStatus: 'unavailable',
    sourceCollections: ['llm_action_logs']
  };
}

function buildTranscriptCoverageDiagnostics(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const llmActionLogs = Array.isArray(payload.llmActionLogs) ? payload.llmActionLogs : [];
  const transcriptWriteOutcomeCounts = createOutcomeCounts();
  const reasonCounts = {};
  const snapshotInputDiagnostics = createSnapshotInputDiagnostics();
  let observedCount = 0;

  llmActionLogs.forEach((row) => {
    const outcome = normalizeOutcome(row && row.transcriptSnapshotOutcome);
    if (!outcome) return;
    observedCount += 1;
    transcriptWriteOutcomeCounts[outcome] += 1;
    const reason = normalizeReason(row && row.transcriptSnapshotReason);
    if (!reason) return;
    reasonCounts[reason] = Number(reasonCounts[reason] || 0) + 1;
  });

  llmActionLogs.forEach((row) => {
    const assistantReplyPresent = row && typeof row.transcriptSnapshotAssistantReplyPresent === 'boolean'
      ? row.transcriptSnapshotAssistantReplyPresent
      : null;
    const snapshotBuildAttempted = row && typeof row.transcriptSnapshotBuildAttempted === 'boolean'
      ? row.transcriptSnapshotBuildAttempted
      : null;
    const skippedReason = normalizeTranscriptSnapshotBuildSkippedReason(row && row.transcriptSnapshotBuildSkippedReason);

    recordBooleanCounts(snapshotInputDiagnostics.assistantReplyPresent, assistantReplyPresent);
    recordBooleanCounts(snapshotInputDiagnostics.snapshotBuildAttempted, snapshotBuildAttempted);
    recordLengthStat(snapshotInputDiagnostics.assistantReplyLength, row && row.transcriptSnapshotAssistantReplyLength);
    recordLengthStat(snapshotInputDiagnostics.sanitizedReplyLength, row && row.transcriptSnapshotSanitizedReplyLength);
    if (skippedReason) {
      snapshotInputDiagnostics.snapshotBuildSkippedReason[skippedReason] += 1;
    }
  });

  const writtenCount = Number(transcriptWriteOutcomeCounts.written || 0);
  const skippedCount = Number(transcriptWriteOutcomeCounts.skipped_flag_disabled || 0)
    + Number(transcriptWriteOutcomeCounts.skipped_missing_line_user_key || 0)
    + Number(transcriptWriteOutcomeCounts.skipped_unreviewable_transcript || 0);
  const failedCount = Number(transcriptWriteOutcomeCounts.failed_repo_write || 0)
    + Number(transcriptWriteOutcomeCounts.failed_unknown || 0);

  return {
    observedCount,
    writtenCount,
    skippedCount,
    failedCount,
    transcriptWriteOutcomeCounts,
    transcriptWriteFailureReasons: sortObject(reasonCounts),
    snapshotInputDiagnostics,
    transcriptCoverageStatus: resolveTranscriptCoverageStatus(transcriptWriteOutcomeCounts, observedCount),
    sourceCollections: ['llm_action_logs']
  };
}

module.exports = {
  TRANSCRIPT_SNAPSHOT_OUTCOME_KEYS,
  TRANSCRIPT_SNAPSHOT_BUILD_SKIPPED_REASON_KEYS,
  normalizeTranscriptSnapshotOutcome: normalizeOutcome,
  normalizeTranscriptSnapshotReason: normalizeReason,
  normalizeTranscriptSnapshotBuildSkippedReason,
  createEmptyTranscriptCoverageDiagnostics,
  buildTranscriptCoverageDiagnostics,
  resolveTranscriptCoverageStatus
};
