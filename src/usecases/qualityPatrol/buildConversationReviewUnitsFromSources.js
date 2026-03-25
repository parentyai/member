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
const {
  buildLineUserKey
} = require('../../domain/qualityPatrol/transcriptMasking/buildMaskedConversationReviewSnapshot');

const SYNTHETIC_PATROL_REPLAY_PREFIXES = Object.freeze([
  'quality_patrol_cycle_',
  'quality_patrol_replay_'
]);

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

function normalizeText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hasExplicitSourceWindow(payload) {
  return Boolean(toIso(payload && payload.fromAt) || toIso(payload && payload.toAt));
}

function isSyntheticPatrolReplayRow(row) {
  const traceId = normalizeText(row && row.traceId) || '';
  const requestId = normalizeText(row && row.requestId) || '';
  return SYNTHETIC_PATROL_REPLAY_PREFIXES.some((prefix) => traceId.startsWith(prefix) || requestId.startsWith(prefix));
}

function filterSyntheticPatrolReplayRows(payload, llmActionLogs) {
  const rows = Array.isArray(llmActionLogs) ? llmActionLogs : [];
  if (payload && payload.includeSyntheticReplay === true) return rows;
  if (hasExplicitSourceWindow(payload)) return rows;
  return rows.filter((row) => !isSyntheticPatrolReplayRow(row));
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

function resolveCollectionReadLimits(payload, llmActionLogs, reviewLimit) {
  const actionCount = Array.isArray(llmActionLogs) ? llmActionLogs.length : 0;
  const requestedSourceLimit = normalizeLimit(payload && payload.sourceReadLimit, 0, 500);
  if (requestedSourceLimit > 0) {
    return {
      snapshotReadLimit: requestedSourceLimit,
      faqReadLimit: requestedSourceLimit
    };
  }
  const sourceBaseline = actionCount > 0 ? actionCount : reviewLimit;
  return {
    snapshotReadLimit: Math.min(Math.max(sourceBaseline * 6, reviewLimit), 500),
    faqReadLimit: Math.min(Math.max(sourceBaseline * 2, reviewLimit), 500)
  };
}

function buildConversationJoinKeys(llmActionLogs) {
  const traceIds = new Set();
  const lineUserKeys = new Set();
  (Array.isArray(llmActionLogs) ? llmActionLogs : []).forEach((row) => {
    const traceId = normalizeText(row && row.traceId);
    if (traceId) traceIds.add(traceId);
    const lineUserKey = buildLineUserKey(row && row.lineUserId);
    if (lineUserKey) lineUserKeys.add(lineUserKey);
  });
  return {
    traceIds,
    lineUserKeys
  };
}

function filterSnapshotsForConversationWindow(snapshots, llmActionLogs) {
  const rows = Array.isArray(snapshots) ? snapshots : [];
  const joinKeys = buildConversationJoinKeys(llmActionLogs);
  if (joinKeys.traceIds.size <= 0 && joinKeys.lineUserKeys.size <= 0) return rows;
  return rows.filter((row) => {
    const traceId = normalizeText(row && row.traceId);
    if (traceId && joinKeys.traceIds.has(traceId)) return true;
    const lineUserKey = normalizeText(row && row.lineUserKey);
    if (lineUserKey && joinKeys.lineUserKeys.has(lineUserKey)) return true;
    return false;
  });
}

function filterFaqAnswerLogsForConversationWindow(faqAnswerLogs, llmActionLogs) {
  const rows = Array.isArray(faqAnswerLogs) ? faqAnswerLogs : [];
  const joinKeys = buildConversationJoinKeys(llmActionLogs);
  if (joinKeys.traceIds.size <= 0) return rows;
  return rows.filter((row) => {
    const traceId = normalizeText(row && row.traceId);
    return Boolean(traceId && joinKeys.traceIds.has(traceId));
  });
}

async function hydrateMissingSnapshotsByTraceId(snapshotsRepo, snapshots, llmActionLogs, reviewLimit) {
  if (!snapshotsRepo || typeof snapshotsRepo.listConversationReviewSnapshotsByTraceId !== 'function') return [];
  const traceIds = Array.from(buildConversationJoinKeys(llmActionLogs).traceIds);
  if (traceIds.length <= 0) return [];
  const hydratedTraceIds = new Set(
    (Array.isArray(snapshots) ? snapshots : [])
      .map((row) => normalizeText(row && row.traceId))
      .filter(Boolean)
  );
  const missingTraceIds = traceIds.filter((traceId) => !hydratedTraceIds.has(traceId)).slice(0, Math.min(reviewLimit, 25));
  if (missingTraceIds.length <= 0) return [];
  const rows = await Promise.all(
    missingTraceIds.map((traceId) => snapshotsRepo.listConversationReviewSnapshotsByTraceId({
      traceId,
      limit: 4
    }))
  );
  const deduped = new Map();
  rows.flat().forEach((row) => {
    const rowId = normalizeText(row && row.id);
    if (!rowId) return;
    if (!deduped.has(rowId)) deduped.set(rowId, row);
  });
  return Array.from(deduped.values());
}

async function buildConversationReviewUnitsFromSources(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = normalizeLimit(payload.limit, 100, 500);
  const traceLimit = normalizeLimit(payload.traceLimit, Math.min(limit, 200), 200);
  const explicitSourceWindow = hasExplicitSourceWindow(payload);
  const snapshotsRepo = deps && deps.conversationReviewSnapshotsRepo ? deps.conversationReviewSnapshotsRepo : conversationReviewSnapshotsRepo;
  const actionRepo = deps && deps.llmActionLogsRepo ? deps.llmActionLogsRepo : llmActionLogsRepo;
  const faqRepo = deps && deps.faqAnswerLogsRepo ? deps.faqAnswerLogsRepo : faqAnswerLogsRepo;
  const getTraceBundleUsecase = deps && deps.getTraceBundle ? deps.getTraceBundle : getTraceBundle;

  const rawLlmActionLogs = await actionRepo.listLlmActionLogsByCreatedAtRange({
    fromAt: payload.fromAt,
    toAt: payload.toAt,
    limit
  });
  const llmActionLogs = filterSyntheticPatrolReplayRows(payload, rawLlmActionLogs);
  const sourceWindow = deriveSourceWindow(payload, llmActionLogs);
  const readLimits = resolveCollectionReadLimits(payload, llmActionLogs, limit);
  const transcriptCoverage = buildTranscriptCoverageDiagnostics({ llmActionLogs });
  const joinDiagnostics = {
    faqOnlyRowsSkipped: 0,
    traceHydrationLimitedCount: 0,
    reviewUnitAnchorKindCounts: {}
  };

  if (llmActionLogs.length <= 0 && !explicitSourceWindow) {
    return {
      ok: true,
      sourceWindow,
      reviewUnits: [],
      llmActionLogs,
      transcriptCoverage,
      sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'faq_answer_logs', 'trace_bundle'],
      counts: {
        snapshots: 0,
        snapshotsHydratedByTraceId: 0,
        llmActionLogs: 0,
        faqAnswerLogs: 0,
        traceBundles: 0
      },
      readLimits,
      joinDiagnostics
    };
  }

  const [fetchedSnapshots, fetchedFaqAnswerLogs] = await Promise.all([
    snapshotsRepo.listConversationReviewSnapshotsByCreatedAtRange({
      fromAt: sourceWindow.fromAt,
      toAt: sourceWindow.toAt,
      limit: readLimits.snapshotReadLimit
    }),
    faqRepo.listFaqAnswerLogsByCreatedAtRange({
      fromAt: sourceWindow.fromAt,
      toAt: sourceWindow.toAt,
      limit: readLimits.faqReadLimit
    })
  ]);
  const rawSnapshots = filterSyntheticPatrolReplayRows(payload, fetchedSnapshots);
  const rawFaqAnswerLogs = filterSyntheticPatrolReplayRows(payload, fetchedFaqAnswerLogs);
  const snapshots = filterSnapshotsForConversationWindow(rawSnapshots, llmActionLogs);
  const hydratedSnapshots = await hydrateMissingSnapshotsByTraceId(snapshotsRepo, snapshots, llmActionLogs, limit);
  const mergedSnapshots = filterSnapshotsForConversationWindow(snapshots.concat(hydratedSnapshots), llmActionLogs);
  const faqAnswerLogs = filterFaqAnswerLogsForConversationWindow(rawFaqAnswerLogs, llmActionLogs);
  const anchorBuild = buildConversationReviewAnchors({
    snapshots: mergedSnapshots,
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
      snapshots: mergedSnapshots.length,
      snapshotsHydratedByTraceId: hydratedSnapshots.length,
      llmActionLogs: llmActionLogs.length,
      faqAnswerLogs: faqAnswerLogs.length,
      traceBundles: traceIds.length
    },
    readLimits,
    joinDiagnostics
  };
}

module.exports = {
  buildConversationReviewUnitsFromSources
};
