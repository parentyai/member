'use strict';

const conversationReviewSnapshotsRepo = require('../../repos/firestore/conversationReviewSnapshotsRepo');
const llmActionLogsRepo = require('../../repos/firestore/llmActionLogsRepo');
const faqAnswerLogsRepo = require('../../repos/firestore/faqAnswerLogsRepo');
const { getTraceBundle } = require('../admin/getTraceBundle');
const { buildConversationReviewUnits } = require('../../domain/qualityPatrol/transcript/buildConversationReviewUnits');

function normalizeLimit(value, fallback, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(numeric)));
}

async function buildConversationReviewUnitsFromSources(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = normalizeLimit(payload.limit, 100, 500);
  const traceLimit = normalizeLimit(payload.traceLimit, 50, 200);
  const snapshotsRepo = deps && deps.conversationReviewSnapshotsRepo ? deps.conversationReviewSnapshotsRepo : conversationReviewSnapshotsRepo;
  const actionRepo = deps && deps.llmActionLogsRepo ? deps.llmActionLogsRepo : llmActionLogsRepo;
  const faqRepo = deps && deps.faqAnswerLogsRepo ? deps.faqAnswerLogsRepo : faqAnswerLogsRepo;
  const getTraceBundleUsecase = deps && deps.getTraceBundle ? deps.getTraceBundle : getTraceBundle;

  const [snapshots, llmActionLogs, faqAnswerLogs] = await Promise.all([
    snapshotsRepo.listConversationReviewSnapshotsByCreatedAtRange({
      fromAt: payload.fromAt,
      toAt: payload.toAt,
      limit
    }),
    actionRepo.listLlmActionLogsByCreatedAtRange({
      fromAt: payload.fromAt,
      toAt: payload.toAt,
      limit
    }),
    faqRepo.listFaqAnswerLogsByCreatedAtRange({
      fromAt: payload.fromAt,
      toAt: payload.toAt,
      limit
    })
  ]);

  const traceIds = Array.from(new Set([]
    .concat(snapshots.map((row) => row && row.traceId))
    .concat(llmActionLogs.map((row) => row && row.traceId))
    .concat(faqAnswerLogs.map((row) => row && row.traceId))
    .filter((item) => typeof item === 'string' && item.trim()))).slice(0, traceLimit);

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
    snapshots,
    llmActionLogs,
    faqAnswerLogs,
    traceBundles
  });

  return {
    ok: true,
    sourceWindow: {
      fromAt: payload.fromAt || null,
      toAt: payload.toAt || null
    },
    reviewUnits,
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'faq_answer_logs', 'trace_bundle'],
    counts: {
      snapshots: snapshots.length,
      llmActionLogs: llmActionLogs.length,
      faqAnswerLogs: faqAnswerLogs.length,
      traceBundles: traceIds.length
    }
  };
}

module.exports = {
  buildConversationReviewUnitsFromSources
};
