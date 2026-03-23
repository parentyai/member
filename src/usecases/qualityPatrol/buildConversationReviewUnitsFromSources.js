'use strict';

const conversationReviewSnapshotsRepo = require('../../repos/firestore/conversationReviewSnapshotsRepo');
const llmActionLogsRepo = require('../../repos/firestore/llmActionLogsRepo');
const faqAnswerLogsRepo = require('../../repos/firestore/faqAnswerLogsRepo');
const { getTraceBundle } = require('../admin/getTraceBundle');
const {
  buildConversationReviewAnchors,
  buildConversationReviewUnits
} = require('../../domain/qualityPatrol/transcript/buildConversationReviewUnits');
const {
  buildTranscriptCoverageDiagnostics
} = require('../../domain/qualityPatrol/transcript/buildTranscriptCoverageDiagnostics');

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

function deriveSourceWindow(payload, llmActionLogs) {
  const requestedFromAt = toIso(payload && payload.fromAt);
  const requestedToAt = toIso(payload && payload.toAt);
  if (requestedFromAt || requestedToAt) {
    return {
      fromAt: requestedFromAt,
      toAt: requestedToAt
    };
  }

  const times = (Array.isArray(llmActionLogs) ? llmActionLogs : [])
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

async function buildConversationReviewUnitsFromSources(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = normalizeLimit(payload.limit, 100, 500);
  const traceLimit = normalizeLimit(payload.traceLimit, Math.min(limit, 200), 200);
  const snapshotsRepo = deps && deps.conversationReviewSnapshotsRepo ? deps.conversationReviewSnapshotsRepo : conversationReviewSnapshotsRepo;
  const actionRepo = deps && deps.llmActionLogsRepo ? deps.llmActionLogsRepo : llmActionLogsRepo;
  const faqRepo = deps && deps.faqAnswerLogsRepo ? deps.faqAnswerLogsRepo : faqAnswerLogsRepo;
  const getTraceBundleUsecase = deps && deps.getTraceBundle ? deps.getTraceBundle : getTraceBundle;

  const llmActionLogs = await actionRepo.listLlmActionLogsByCreatedAtRange({
    fromAt: payload.fromAt,
    toAt: payload.toAt,
    limit
  });
  const sourceWindow = deriveSourceWindow(payload, llmActionLogs);

  const [snapshots, faqAnswerLogs] = await Promise.all([
    snapshotsRepo.listConversationReviewSnapshotsByCreatedAtRange({
      fromAt: sourceWindow.fromAt,
      toAt: sourceWindow.toAt,
      limit
    }),
    faqRepo.listFaqAnswerLogsByCreatedAtRange({
      fromAt: sourceWindow.fromAt,
      toAt: sourceWindow.toAt,
      limit
    })
  ]);

  const joinDiagnostics = {
    faqOnlyRowsSkipped: 0,
    traceHydrationLimitedCount: 0,
    reviewUnitAnchorKindCounts: {}
  };
  const anchorBuild = buildConversationReviewAnchors({
    snapshots,
    llmActionLogs,
    faqAnswerLogs,
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
  const transcriptCoverage = buildTranscriptCoverageDiagnostics({ llmActionLogs });
  const reviewUnits = buildConversationReviewUnits({
    anchors: anchorBuild.anchors,
    traceBundles,
    traceHydrationLimitedTraceIds: limitedTraceIds
  });

  return {
    ok: true,
    sourceWindow,
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
