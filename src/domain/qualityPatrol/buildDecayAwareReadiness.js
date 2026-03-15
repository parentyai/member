'use strict';

const RECENT_WINDOW_REVIEW_UNIT_COUNT = 5;

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function emptyWindow(sourceWindow) {
  return {
    sourceWindow: {
      fromAt: sourceWindow && sourceWindow.fromAt ? sourceWindow.fromAt : null,
      toAt: sourceWindow && sourceWindow.toAt ? sourceWindow.toAt : null
    },
    observedCount: 0,
    written: 0,
    skipped_unreviewable_transcript: 0,
    assistant_reply_missing: 0,
    reviewUnitCount: 0,
    faqOnlyRowsSkipped: 0,
    traceHydrationLimitedCount: 0,
    blockerCount: 0,
    blockerCodes: []
  };
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'ja'));
}

function extractWindowTimes(reviewUnits) {
  const times = (Array.isArray(reviewUnits) ? reviewUnits : [])
    .flatMap((unit) => [
      toIso(unit && unit.sourceWindow && unit.sourceWindow.fromAt),
      toIso(unit && unit.sourceWindow && unit.sourceWindow.toAt)
    ])
    .filter(Boolean)
    .sort();
  if (times.length <= 0) return { fromAt: null, toAt: null };
  return {
    fromAt: times[0],
    toAt: times[times.length - 1]
  };
}

function extractWindowTimesFromActionLogs(llmActionLogs) {
  const times = (Array.isArray(llmActionLogs) ? llmActionLogs : [])
    .flatMap((row) => [toIso(row && row.createdAt)])
    .filter(Boolean)
    .sort();
  if (times.length <= 0) return { fromAt: null, toAt: null };
  return {
    fromAt: times[0],
    toAt: times[times.length - 1]
  };
}

function deriveRecentWindowFromReviewUnits(reviewUnits, maxUnits) {
  const limit = Number.isFinite(Number(maxUnits))
    ? Math.max(1, Math.floor(Number(maxUnits)))
    : RECENT_WINDOW_REVIEW_UNIT_COUNT;
  const scoped = (Array.isArray(reviewUnits) ? reviewUnits : [])
    .slice()
    .sort((left, right) => {
      const leftAt = toIso(left && left.sourceWindow && left.sourceWindow.toAt);
      const rightAt = toIso(right && right.sourceWindow && right.sourceWindow.toAt);
      return (rightAt ? new Date(rightAt).getTime() : 0) - (leftAt ? new Date(leftAt).getTime() : 0);
    })
    .slice(0, limit);
  return extractWindowTimes(scoped);
}

function deriveRecentWindowFromLlmActionLogs(llmActionLogs, maxRows) {
  const limit = Number.isFinite(Number(maxRows))
    ? Math.max(1, Math.floor(Number(maxRows)))
    : RECENT_WINDOW_REVIEW_UNIT_COUNT;
  const scoped = (Array.isArray(llmActionLogs) ? llmActionLogs : [])
    .filter((row) => typeof (row && row.transcriptSnapshotOutcome) === 'string' && row.transcriptSnapshotOutcome.trim())
    .slice()
    .sort((left, right) => {
      const leftAt = toIso(left && left.createdAt);
      const rightAt = toIso(right && right.createdAt);
      return (rightAt ? new Date(rightAt).getTime() : 0) - (leftAt ? new Date(leftAt).getTime() : 0);
    })
    .slice(0, limit);
  return extractWindowTimesFromActionLogs(scoped);
}

function derivePreviousWindow(sourceWindow) {
  const fromAt = toIso(sourceWindow && sourceWindow.fromAt);
  const toAt = toIso(sourceWindow && sourceWindow.toAt);
  if (!fromAt || !toAt) return { fromAt: null, toAt: null };
  const fromMs = new Date(fromAt).getTime();
  const toMs = new Date(toAt).getTime();
  const durationMs = toMs - fromMs;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return { fromAt: null, toAt: null };
  return {
    fromAt: new Date(fromMs - durationMs).toISOString(),
    toAt: new Date(fromMs).toISOString()
  };
}

function buildWindowSnapshot(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const reviewUnits = Array.isArray(payload.reviewUnits) ? payload.reviewUnits : [];
  const transcriptCoverage = payload.transcriptCoverage && typeof payload.transcriptCoverage === 'object'
    ? payload.transcriptCoverage
    : {};
  const joinDiagnostics = payload.joinDiagnostics && typeof payload.joinDiagnostics === 'object'
    ? payload.joinDiagnostics
    : {};
  const observationBlockers = Array.isArray(payload.observationBlockers) ? payload.observationBlockers : [];
  const sourceWindow = (payload.sourceWindow && (payload.sourceWindow.fromAt || payload.sourceWindow.toAt))
    ? {
      fromAt: toIso(payload.sourceWindow.fromAt),
      toAt: toIso(payload.sourceWindow.toAt)
    }
    : extractWindowTimes(reviewUnits);
  const blockerCodes = uniqueStrings(observationBlockers.map((item) => item && item.code).filter(Boolean));

  return {
    sourceWindow,
    observedCount: Number(transcriptCoverage.observedCount || 0),
    written: Number(transcriptCoverage.transcriptWriteOutcomeCounts && transcriptCoverage.transcriptWriteOutcomeCounts.written || 0),
    skipped_unreviewable_transcript: Number(
      transcriptCoverage.transcriptWriteOutcomeCounts
      && transcriptCoverage.transcriptWriteOutcomeCounts.skipped_unreviewable_transcript
      || 0
    ),
    assistant_reply_missing: Number(
      transcriptCoverage.snapshotInputDiagnostics
      && transcriptCoverage.snapshotInputDiagnostics.assistant_reply_missing
      || 0
    ),
    reviewUnitCount: reviewUnits.length,
    faqOnlyRowsSkipped: Number(joinDiagnostics.faqOnlyRowsSkipped || 0),
    traceHydrationLimitedCount: Number(joinDiagnostics.traceHydrationLimitedCount || 0),
    blockerCount: blockerCodes.length,
    blockerCodes
  };
}

function buildDeltaFromPreviousFullWindow(fullWindow, previousFullWindow) {
  if (!previousFullWindow || (!previousFullWindow.sourceWindow || (!previousFullWindow.sourceWindow.fromAt && !previousFullWindow.sourceWindow.toAt))) {
    return {
      available: false,
      status: 'unavailable',
      observedCount: 0,
      written: 0,
      skipped_unreviewable_transcript: 0,
      assistant_reply_missing: 0,
      reviewUnitCount: 0,
      faqOnlyRowsSkipped: 0,
      traceHydrationLimitedCount: 0,
      blockerCount: 0
    };
  }

  const delta = {
    available: true,
    observedCount: Number(fullWindow.observedCount || 0) - Number(previousFullWindow.observedCount || 0),
    written: Number(fullWindow.written || 0) - Number(previousFullWindow.written || 0),
    skipped_unreviewable_transcript: Number(fullWindow.skipped_unreviewable_transcript || 0) - Number(previousFullWindow.skipped_unreviewable_transcript || 0),
    assistant_reply_missing: Number(fullWindow.assistant_reply_missing || 0) - Number(previousFullWindow.assistant_reply_missing || 0),
    reviewUnitCount: Number(fullWindow.reviewUnitCount || 0) - Number(previousFullWindow.reviewUnitCount || 0),
    faqOnlyRowsSkipped: Number(fullWindow.faqOnlyRowsSkipped || 0) - Number(previousFullWindow.faqOnlyRowsSkipped || 0),
    traceHydrationLimitedCount: Number(fullWindow.traceHydrationLimitedCount || 0) - Number(previousFullWindow.traceHydrationLimitedCount || 0),
    blockerCount: Number(fullWindow.blockerCount || 0) - Number(previousFullWindow.blockerCount || 0)
  };

  const improving = delta.skipped_unreviewable_transcript < 0
    || delta.assistant_reply_missing < 0
    || delta.faqOnlyRowsSkipped < 0
    || delta.traceHydrationLimitedCount < 0
    || delta.blockerCount < 0;
  const worsening = delta.skipped_unreviewable_transcript > 0
    || delta.assistant_reply_missing > 0
    || delta.faqOnlyRowsSkipped > 0
    || delta.traceHydrationLimitedCount > 0
    || delta.blockerCount > 0;

  delta.status = improving
    ? 'improving'
    : (worsening ? 'worsening' : 'stagnating');
  return delta;
}

function resolveRecentWindowStatus(snapshot) {
  const row = snapshot && typeof snapshot === 'object' ? snapshot : emptyWindow();
  if (row.observedCount <= 0) return 'unavailable';
  if (
    row.skipped_unreviewable_transcript <= 0
    && row.assistant_reply_missing <= 0
    && row.faqOnlyRowsSkipped <= 0
    && row.traceHydrationLimitedCount <= 0
  ) {
    return 'healthy';
  }
  return 'unhealthy';
}

function resolveHistoricalBacklogStatus(fullWindow, recentWindow, deltaFromPreviousFullWindow) {
  const recentStatus = resolveRecentWindowStatus(recentWindow);
  const full = fullWindow && typeof fullWindow === 'object' ? fullWindow : emptyWindow();
  const hasHistoricalDebt = full.skipped_unreviewable_transcript > 0
    || full.assistant_reply_missing > 0
    || full.faqOnlyRowsSkipped > 0
    || full.traceHydrationLimitedCount > 0
    || full.blockerCount > 0;
  if (!hasHistoricalDebt) return 'cleared';
  if (recentStatus !== 'healthy') return 'current_runtime_overlap';
  if (deltaFromPreviousFullWindow && deltaFromPreviousFullWindow.status === 'improving') return 'decaying';
  return 'stagnating';
}

function resolveOverallReadinessStatus(fullWindow, recentWindow, deltaFromPreviousFullWindow) {
  const recentStatus = resolveRecentWindowStatus(recentWindow);
  if (recentStatus !== 'healthy') return 'current_runtime_or_current_join_problem';
  const historicalStatus = resolveHistoricalBacklogStatus(fullWindow, recentWindow, deltaFromPreviousFullWindow);
  if (historicalStatus === 'cleared') return 'readiness_candidate';
  if (historicalStatus === 'decaying') return 'observation_continue_backlog_decay';
  return 'historical_backlog_dominant';
}

function buildHistoricalDebt(fullWindow, recentWindow, deltaFromPreviousFullWindow) {
  const full = fullWindow && typeof fullWindow === 'object' ? fullWindow : emptyWindow();
  const recent = recentWindow && typeof recentWindow === 'object' ? recentWindow : emptyWindow();
  const debtCounts = {
    skipped_unreviewable_transcript: Math.max(0, full.skipped_unreviewable_transcript - recent.skipped_unreviewable_transcript),
    assistant_reply_missing: Math.max(0, full.assistant_reply_missing - recent.assistant_reply_missing),
    faq_only_rows_skipped: Math.max(0, full.faqOnlyRowsSkipped - recent.faqOnlyRowsSkipped),
    action_trace_join_limited: Math.max(0, full.traceHydrationLimitedCount - recent.traceHydrationLimitedCount),
    blocker_count: Math.max(0, full.blockerCount - recent.blockerCount)
  };
  const transcriptDebtCount = Math.max(0, full.skipped_unreviewable_transcript - recent.skipped_unreviewable_transcript)
    + Math.max(0, full.assistant_reply_missing - recent.assistant_reply_missing);
  const joinDebtCount = Math.max(0, full.faqOnlyRowsSkipped - recent.faqOnlyRowsSkipped)
    + Math.max(0, full.traceHydrationLimitedCount - recent.traceHydrationLimitedCount);
  return {
    status: transcriptDebtCount > 0 || joinDebtCount > 0 ? 'present' : 'cleared',
    trend: deltaFromPreviousFullWindow && deltaFromPreviousFullWindow.available
      ? deltaFromPreviousFullWindow.status
      : 'unavailable',
    sourceWindow: {
      fromAt: full && full.sourceWindow ? full.sourceWindow.fromAt || null : null,
      toAt: full && full.sourceWindow ? full.sourceWindow.toAt || null : null
    },
    observedCount: Number(full.observedCount || 0),
    reviewUnitCount: Number(full.reviewUnitCount || 0),
    debtCounts,
    totalDebtCount: Object.values(debtCounts).reduce((sum, value) => sum + Number(value || 0), 0),
    transcriptDebtCount,
    joinDebtCount,
    dominantDebt: transcriptDebtCount >= joinDebtCount ? 'transcript_coverage' : 'join_limit',
    blockerCount: Math.max(0, full.blockerCount - recent.blockerCount)
  };
}

function buildCurrentRuntimeHealth(recentWindow) {
  const recentStatus = resolveRecentWindowStatus(recentWindow);
  return {
    status: recentStatus,
    sourceWindow: {
      fromAt: recentWindow && recentWindow.sourceWindow ? recentWindow.sourceWindow.fromAt || null : null,
      toAt: recentWindow && recentWindow.sourceWindow ? recentWindow.sourceWindow.toAt || null : null
    },
    observedCount: Number(recentWindow && recentWindow.observedCount || 0),
    reviewUnitCount: Number(recentWindow && recentWindow.reviewUnitCount || 0),
    transcriptWriteCoverageHealthy: Number(recentWindow && recentWindow.skipped_unreviewable_transcript || 0) <= 0
      && Number(recentWindow && recentWindow.assistant_reply_missing || 0) <= 0,
    joinHealthy: Number(recentWindow && recentWindow.faqOnlyRowsSkipped || 0) <= 0
      && Number(recentWindow && recentWindow.traceHydrationLimitedCount || 0) <= 0
  };
}

function createEmptyDecayAwareReadiness() {
  const fullWindow = emptyWindow();
  const recentWindow = emptyWindow();
  const previousFullWindow = emptyWindow();
  return {
    recentWindowStatus: 'unavailable',
    historicalBacklogStatus: 'unavailable',
    overallReadinessStatus: 'unavailable',
    recentWindow,
    fullWindow,
    previousFullWindow,
    deltaFromPreviousFullWindow: {
      available: false,
      status: 'unavailable',
      observedCount: 0,
      written: 0,
      skipped_unreviewable_transcript: 0,
      assistant_reply_missing: 0,
      reviewUnitCount: 0,
      faqOnlyRowsSkipped: 0,
      traceHydrationLimitedCount: 0,
      blockerCount: 0
    },
    historicalDebt: {
      status: 'unavailable',
      trend: 'unavailable',
      sourceWindow: {
        fromAt: null,
        toAt: null
      },
      observedCount: 0,
      reviewUnitCount: 0,
      debtCounts: {
        skipped_unreviewable_transcript: 0,
        assistant_reply_missing: 0,
        faq_only_rows_skipped: 0,
        action_trace_join_limited: 0,
        blocker_count: 0
      },
      totalDebtCount: 0,
      transcriptDebtCount: 0,
      joinDebtCount: 0,
      dominantDebt: 'transcript_coverage',
      blockerCount: 0
    },
    currentRuntimeHealth: {
      status: 'unavailable',
      sourceWindow: {
        fromAt: null,
        toAt: null
      },
      observedCount: 0,
      reviewUnitCount: 0,
      transcriptWriteCoverageHealthy: false,
      joinHealthy: false
    }
  };
}

function buildDecayAwareReadiness(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const fullWindow = payload.fullWindow && typeof payload.fullWindow === 'object'
    ? payload.fullWindow
    : emptyWindow();
  const recentWindow = payload.recentWindow && typeof payload.recentWindow === 'object'
    ? payload.recentWindow
    : emptyWindow();
  const previousFullWindow = payload.previousFullWindow && typeof payload.previousFullWindow === 'object'
    ? payload.previousFullWindow
    : emptyWindow();
  const deltaFromPreviousFullWindow = buildDeltaFromPreviousFullWindow(fullWindow, previousFullWindow);
  const recentWindowStatus = resolveRecentWindowStatus(recentWindow);
  const historicalBacklogStatus = resolveHistoricalBacklogStatus(fullWindow, recentWindow, deltaFromPreviousFullWindow);
  const overallReadinessStatus = resolveOverallReadinessStatus(fullWindow, recentWindow, deltaFromPreviousFullWindow);
  return {
    recentWindowStatus,
    historicalBacklogStatus,
    overallReadinessStatus,
    recentWindow,
    fullWindow,
    previousFullWindow,
    deltaFromPreviousFullWindow,
    historicalDebt: buildHistoricalDebt(fullWindow, recentWindow, deltaFromPreviousFullWindow),
    currentRuntimeHealth: buildCurrentRuntimeHealth(recentWindow)
  };
}

module.exports = {
  RECENT_WINDOW_REVIEW_UNIT_COUNT,
  toIso,
  extractWindowTimes,
  extractWindowTimesFromActionLogs,
  deriveRecentWindowFromReviewUnits,
  deriveRecentWindowFromLlmActionLogs,
  derivePreviousWindow,
  buildWindowSnapshot,
  buildDeltaFromPreviousFullWindow,
  resolveRecentWindowStatus,
  buildDecayAwareReadiness,
  createEmptyDecayAwareReadiness
};
