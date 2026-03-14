'use strict';

const TRANSCRIPT_SNAPSHOT_OUTCOME_KEYS = Object.freeze([
  'written',
  'skipped_flag_disabled',
  'skipped_missing_line_user_key',
  'skipped_unreviewable_transcript',
  'failed_repo_write',
  'failed_unknown'
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

function createOutcomeCounts() {
  return TRANSCRIPT_SNAPSHOT_OUTCOME_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
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

function createEmptyTranscriptCoverageDiagnostics() {
  const transcriptWriteOutcomeCounts = createOutcomeCounts();
  return {
    observedCount: 0,
    writtenCount: 0,
    skippedCount: 0,
    failedCount: 0,
    transcriptWriteOutcomeCounts,
    transcriptWriteFailureReasons: {},
    transcriptCoverageStatus: 'unavailable',
    sourceCollections: ['llm_action_logs']
  };
}

function buildTranscriptCoverageDiagnostics(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const llmActionLogs = Array.isArray(payload.llmActionLogs) ? payload.llmActionLogs : [];
  const transcriptWriteOutcomeCounts = createOutcomeCounts();
  const reasonCounts = {};
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
    transcriptCoverageStatus: resolveTranscriptCoverageStatus(transcriptWriteOutcomeCounts, observedCount),
    sourceCollections: ['llm_action_logs']
  };
}

module.exports = {
  TRANSCRIPT_SNAPSHOT_OUTCOME_KEYS,
  normalizeTranscriptSnapshotOutcome: normalizeOutcome,
  normalizeTranscriptSnapshotReason: normalizeReason,
  createEmptyTranscriptCoverageDiagnostics,
  buildTranscriptCoverageDiagnostics,
  resolveTranscriptCoverageStatus
};
