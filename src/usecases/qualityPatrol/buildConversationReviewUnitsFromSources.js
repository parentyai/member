'use strict';

const conversationReviewSnapshotsRepo = require('../../repos/firestore/conversationReviewSnapshotsRepo');
const llmActionLogsRepo = require('../../repos/firestore/llmActionLogsRepo');
const { getTraceBundle } = require('../admin/getTraceBundle');
const {
  buildConversationReviewAnchors,
  buildConversationReviewUnits
} = require('../../domain/qualityPatrol/transcript/buildConversationReviewUnits');
const {
  buildTranscriptCoverageDiagnostics
} = require('../../domain/qualityPatrol/transcript/buildTranscriptCoverageDiagnostics');

const SNAPSHOT_TRACE_BACKFILL_LIMIT = 5;

function normalizeLimit(value, fallback, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(numeric)));
}

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

function hasWindow(range) {
  return Boolean(range && (range.fromAt || range.toAt));
}

function buildSourceWindowFromRows(rows) {
  const times = (Array.isArray(rows) ? rows : [])
    .map((row) => toIso(row && row.createdAt))
    .filter(Boolean)
    .sort();
  if (times.length <= 0) {
    return {
      fromAt: null,
      toAt: null
    };
  }
  return {
    fromAt: times[0],
    toAt: times[times.length - 1]
  };
}

function filterRowsByWindow(rows, range) {
  if (!hasWindow(range)) return Array.isArray(rows) ? rows.slice() : [];
  const fromMs = range.fromAt ? new Date(range.fromAt).getTime() : null;
  const toMs = range.toAt ? new Date(range.toAt).getTime() : null;
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const atIso = toIso(row && row.createdAt);
    if (!atIso) return false;
    const atMs = new Date(atIso).getTime();
    if (fromMs !== null && atMs < fromMs) return false;
    if (toMs !== null && atMs > toMs) return false;
    return true;
  });
}

function uniqueTraceIds(rows) {
  return Array.from(new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => (row && typeof row.traceId === 'string' && row.traceId.trim() ? row.traceId.trim() : null))
      .filter(Boolean)
  ));
}

function mergeRowsById() {
  const rows = Array.from(arguments).flat().filter(Boolean);
  const seen = new Set();
  const merged = [];
  rows.forEach((row) => {
    const id = row && typeof row.id === 'string' && row.id.trim()
      ? row.id.trim()
      : [
        row && row.traceId ? row.traceId : 'missing_trace',
        toIso(row && row.createdAt) || 'missing_created_at'
      ].join('|');
    if (seen.has(id)) return;
    seen.add(id);
    merged.push(row);
  });
  return merged;
}

function attachFaqEvidenceFromTraceBundles(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const anchors = payload.anchors instanceof Map ? payload.anchors : new Map();
  const traceBundles = payload.traceBundles && typeof payload.traceBundles === 'object' ? payload.traceBundles : {};
  const sourceWindow = hasWindow(payload.sourceWindow) ? payload.sourceWindow : null;
  const attached = [];

  anchors.forEach((anchor) => {
    const traceId = anchor && typeof anchor.traceId === 'string' && anchor.traceId.trim() ? anchor.traceId.trim() : null;
    if (!traceId) return;
    const traceBundle = traceBundles[traceId];
    const faqRows = filterRowsByWindow(
      traceBundle && traceBundle.joins && Array.isArray(traceBundle.joins.faqAnswerLogs)
        ? traceBundle.joins.faqAnswerLogs
        : [],
      sourceWindow
    );
    if (!Array.isArray(anchor.faqAnswerLogs)) anchor.faqAnswerLogs = [];
    anchor.faqAnswerLogs = mergeRowsById(anchor.faqAnswerLogs, faqRows);
    attached.push(...faqRows);
  });

  return mergeRowsById(attached);
}

async function buildConversationReviewUnitsFromSources(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = normalizeLimit(payload.limit, 100, 500);
  const traceLimit = normalizeLimit(payload.traceLimit, Math.min(limit, 200), 200);
  const snapshotTraceBackfillLimit = normalizeLimit(payload.snapshotTraceBackfillLimit, SNAPSHOT_TRACE_BACKFILL_LIMIT, 20);
  const snapshotsRepo = deps && deps.conversationReviewSnapshotsRepo ? deps.conversationReviewSnapshotsRepo : conversationReviewSnapshotsRepo;
  const actionRepo = deps && deps.llmActionLogsRepo ? deps.llmActionLogsRepo : llmActionLogsRepo;
  const getTraceBundleUsecase = deps && deps.getTraceBundle ? deps.getTraceBundle : getTraceBundle;
  const explicitSourceWindow = hasWindow({
    fromAt: payload.fromAt || null,
    toAt: payload.toAt || null
  })
    ? {
      fromAt: payload.fromAt || null,
      toAt: payload.toAt || null
    }
    : null;

  const [initialSnapshots, llmActionLogs] = await Promise.all([
    snapshotsRepo.listConversationReviewSnapshotsByCreatedAtRange({
      fromAt: payload.fromAt,
      toAt: payload.toAt,
      limit
    }),
    actionRepo.listLlmActionLogsByCreatedAtRange({
      fromAt: payload.fromAt,
      toAt: payload.toAt,
      limit
    })
  ]);

  const initialSnapshotTraceIds = new Set(uniqueTraceIds(initialSnapshots));
  const missingActionTraceIds = uniqueTraceIds(llmActionLogs).filter((traceId) => !initialSnapshotTraceIds.has(traceId));
  const supplementalSnapshots = (await Promise.all(missingActionTraceIds.map(async (traceId) => {
    try {
      const rows = await snapshotsRepo.listConversationReviewSnapshotsByTraceId({
        traceId,
        limit: snapshotTraceBackfillLimit
      });
      return filterRowsByWindow(rows, explicitSourceWindow);
    } catch (_err) {
      return [];
    }
  }))).flat();
  const snapshots = mergeRowsById(initialSnapshots, supplementalSnapshots);

  const joinDiagnostics = {
    faqOnlyRowsSkipped: 0,
    traceHydrationLimitedCount: 0,
    reviewUnitAnchorKindCounts: {}
  };
  const anchorBuild = buildConversationReviewAnchors({
    snapshots,
    llmActionLogs,
    faqAnswerLogs: [],
    joinDiagnosticsTarget: joinDiagnostics
  });
  const traceIds = anchorBuild.anchorTraceIds.slice(0, traceLimit);
  const limitedTraceIds = anchorBuild.anchorTraceIds.slice(traceLimit);
  joinDiagnostics.traceHydrationLimitedCount = limitedTraceIds.length;

  const bundles = await Promise.all(traceIds.map(async (traceId) => {
    try {
      const bundle = await getTraceBundleUsecase({ traceId, limit: traceLimit });
      return [traceId, bundle];
    } catch (_err) {
      return [traceId, null];
    }
  }));

  const traceBundles = Object.fromEntries(bundles);
  const faqAnswerLogs = attachFaqEvidenceFromTraceBundles({
    anchors: anchorBuild.anchors,
    traceBundles,
    sourceWindow: explicitSourceWindow
  });
  const transcriptCoverage = buildTranscriptCoverageDiagnostics({ llmActionLogs });
  const reviewUnits = buildConversationReviewUnits({
    anchors: anchorBuild.anchors,
    traceBundles,
    traceHydrationLimitedTraceIds: limitedTraceIds
  });

  return {
    ok: true,
    sourceWindow: explicitSourceWindow || buildSourceWindowFromRows(snapshots.concat(llmActionLogs)),
    reviewUnits,
    llmActionLogs,
    transcriptCoverage,
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'faq_answer_logs', 'trace_bundle'],
    counts: {
      snapshots: snapshots.length,
      llmActionLogs: llmActionLogs.length,
      faqAnswerLogs: faqAnswerLogs.length,
      traceBundles: traceIds.length
    },
    joinDiagnostics
  };
}

module.exports = {
  buildConversationReviewUnitsFromSources
};
