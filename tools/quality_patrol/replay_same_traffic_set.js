'use strict';

const os = require('node:os');
const path = require('node:path');
const { parseArgs, writeJson } = require('../llm_quality/lib');
const { handleLineWebhook } = require('../../src/routes/webhookLine');
const llmActionLogsRepo = require('../../src/repos/firestore/llmActionLogsRepo');
const conversationReviewSnapshotsRepo = require('../../src/repos/firestore/conversationReviewSnapshotsRepo');
const { buildConversationReviewUnitsFromSources } = require('../../src/usecases/qualityPatrol/buildConversationReviewUnitsFromSources');
const { queryLatestPatrolInsights } = require('../../src/usecases/qualityPatrol/queryLatestPatrolInsights');

const REPLAY_VERSION = 'quality_patrol_replay_harness_v1';
const DEFAULT_OUTPUT_PATH = path.join(os.tmpdir(), 'quality_patrol_replay_result.json');
const DEFAULT_DESTINATION = 'debug';
const DEFAULT_USER_ID = 'U3037952f2f6531a3d8b24fd13ca3c680';
const DEFAULT_PREFIX = 'quality_patrol_replay';
const DEFAULT_MESSAGES = [
  'いまの不安を整理したいです。',
  '今日いちばん優先することを教えてください。',
  '短く要点だけで大丈夫です。',
  '次に聞くべきことはありますか。',
  'まず一歩目だけ決めたいです。'
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function hasOwn(target, key) {
  return Boolean(target) && Object.prototype.hasOwnProperty.call(target, key);
}

function maskLineUserId(lineUserId) {
  const normalized = normalizeString(lineUserId, '');
  if (!normalized) return null;
  if (normalized.length <= 8) return normalized;
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function normalizeOutbound(message) {
  if (!message) return [];
  if (Array.isArray(message)) return message.flatMap(normalizeOutbound);
  if (Array.isArray(message.messages)) return message.messages.flatMap(normalizeOutbound);
  if (typeof message.text === 'string') return [message.text];
  return [];
}

function buildReplayEvent(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const requestId = normalizeString(payload.requestId, null);
  const lineUserId = normalizeString(payload.lineUserId, null);
  const text = normalizeString(payload.text, '');
  const timestamp = Number.isFinite(Number(payload.timestamp)) ? Number(payload.timestamp) : Date.now();
  if (!requestId) {
    const error = new Error('requestId is required to build replay event');
    error.code = 'missing_request_id';
    throw error;
  }
  if (!lineUserId) {
    const error = new Error('lineUserId is required to build replay event');
    error.code = 'missing_line_user_id';
    throw error;
  }
  if (!text) {
    const error = new Error('text is required to build replay event');
    error.code = 'missing_message_text';
    throw error;
  }
  return {
    type: 'message',
    mode: 'active',
    webhookEventId: normalizeString(payload.webhookEventId, `evt_${requestId}`),
    deliveryContext: { isRedelivery: false },
    timestamp,
    source: { type: 'user', userId: lineUserId },
    replyToken: normalizeString(payload.replyToken, `reply_${requestId}`),
    message: {
      id: normalizeString(payload.messageId, `msg_${requestId}`),
      type: 'text',
      text
    }
  };
}

function buildTrustedWebhookBody(event, options) {
  const payload = options && typeof options === 'object' ? options : {};
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    const error = new Error('trusted payload requires a single webhook event object');
    error.code = 'invalid_trusted_payload_event';
    throw error;
  }
  return {
    destination: normalizeString(payload.destination, DEFAULT_DESTINATION),
    events: [event]
  };
}

function validateTrustedWebhookBody(payload) {
  const body = payload && typeof payload === 'object' ? payload : null;
  const events = body && Array.isArray(body.events) ? body.events : null;
  if (!body || Array.isArray(body)) {
    const error = new Error('trusted payload must be an object with destination and events');
    error.code = 'invalid_trusted_payload_shape';
    throw error;
  }
  if (!normalizeString(body.destination, '')) {
    const error = new Error('trusted payload must include a non-empty destination');
    error.code = 'invalid_trusted_payload_destination';
    throw error;
  }
  if (!events || events.length !== 1 || !events[0] || typeof events[0] !== 'object' || Array.isArray(events[0])) {
    const error = new Error('trusted payload must use { destination, events:[event] } with exactly one event');
    error.code = 'invalid_trusted_payload_shape';
    throw error;
  }
  return body;
}

function parseReplayArgs(argv) {
  const args = parseArgs(argv || process.argv);
  return {
    userId: normalizeString(args['user-id'], DEFAULT_USER_ID),
    output: normalizeString(args.output, DEFAULT_OUTPUT_PATH),
    destination: normalizeString(args.destination, DEFAULT_DESTINATION),
    prefix: normalizeString(args.prefix, DEFAULT_PREFIX),
    pollAttempts: Number.isFinite(Number(args['poll-attempts'])) ? Math.max(1, Math.floor(Number(args['poll-attempts']))) : 20,
    pollIntervalMs: Number.isFinite(Number(args['poll-interval-ms'])) ? Math.max(100, Math.floor(Number(args['poll-interval-ms']))) : 1000,
    messages: DEFAULT_MESSAGES.slice()
  };
}

async function findPersistedActionLog(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const getByRequestId = typeof deps.getLlmActionLogByRequestId === 'function'
    ? deps.getLlmActionLogByRequestId
    : null;
  const listByLineUserId = deps.listLlmActionLogsByLineUserId;
  for (let attempt = 0; attempt < payload.pollAttempts; attempt += 1) {
    if (getByRequestId) {
      const direct = await getByRequestId({ requestId: payload.requestId });
      if (direct) {
        return { row: direct, attempts: attempt + 1 };
      }
    }
    const rows = await listByLineUserId({
      lineUserId: payload.lineUserId,
      limit: payload.limit || 250,
      fromAt: payload.fromAt
    });
    const match = rows.find((row) => row && row.requestId === payload.requestId);
    if (match) {
      return { row: match, attempts: attempt + 1 };
    }
    if (attempt < payload.pollAttempts - 1) await deps.sleep(payload.pollIntervalMs);
  }
  return { row: null, attempts: payload.pollAttempts };
}

async function buildRecentSummary(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  try {
    const recentSources = await deps.buildConversationReviewUnitsFromSources({
      fromAt: payload.fromAt,
      toAt: payload.toAt,
      limit: 100,
      traceLimit: 50
    });
    const recentOperator = await deps.queryLatestPatrolInsights({
      mode: 'newly-detected-improvements',
      audience: 'operator',
      fromAt: payload.fromAt,
      toAt: payload.toAt
    });
    const recentHuman = await deps.queryLatestPatrolInsights({
      mode: 'newly-detected-improvements',
      audience: 'human',
      fromAt: payload.fromAt,
      toAt: payload.toAt
    });
    return {
      ok: true,
      observedCount: recentSources && recentSources.transcriptCoverage ? recentSources.transcriptCoverage.observedCount : 0,
      written: recentSources && recentSources.transcriptCoverage && recentSources.transcriptCoverage.transcriptWriteOutcomeCounts
        ? recentSources.transcriptCoverage.transcriptWriteOutcomeCounts.written
        : 0,
      skipped_unreviewable_transcript: recentSources && recentSources.transcriptCoverage && recentSources.transcriptCoverage.transcriptWriteOutcomeCounts
        ? recentSources.transcriptCoverage.transcriptWriteOutcomeCounts.skipped_unreviewable_transcript
        : 0,
      assistant_reply_missing: recentSources && recentSources.transcriptCoverage && recentSources.transcriptCoverage.snapshotInputDiagnostics
        ? recentSources.transcriptCoverage.snapshotInputDiagnostics.assistant_reply_missing || 0
        : 0,
      reviewUnitCount: Array.isArray(recentSources && recentSources.reviewUnits) ? recentSources.reviewUnits.length : 0,
      faqOnlyRowsSkipped: recentSources && recentSources.joinDiagnostics ? recentSources.joinDiagnostics.faqOnlyRowsSkipped || 0 : 0,
      traceHydrationLimitedCount: recentSources && recentSources.joinDiagnostics ? recentSources.joinDiagnostics.traceHydrationLimitedCount || 0 : 0,
      operatorTraceRefs: Array.isArray(recentOperator && recentOperator.traceRefs) ? recentOperator.traceRefs.length : 0,
      humanTraceRefs: Array.isArray(recentHuman && recentHuman.traceRefs) ? recentHuman.traceRefs.length : 0,
      operatorObservationBlockers: Array.isArray(recentOperator && recentOperator.observationBlockers)
        ? recentOperator.observationBlockers.map((row) => row && row.code).filter(Boolean)
        : [],
      sourceWindow: recentSources && recentSources.sourceWindow ? recentSources.sourceWindow : { fromAt: payload.fromAt, toAt: payload.toAt }
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: normalizeString(error && error.code, 'recent_summary_failed'),
        message: normalizeString(error && error.message, 'failed to build recent summary')
      }
    };
  }
}

async function replaySameTrafficSet(input, overrides) {
  const options = Object.assign({}, parseReplayArgs(['node', 'tools/quality_patrol/replay_same_traffic_set.js']), input || {});
  const overrideDeps = overrides && typeof overrides === 'object' ? overrides : null;
  const deps = Object.assign({
    handleLineWebhook,
    listLlmActionLogsByLineUserId: llmActionLogsRepo.listLlmActionLogsByLineUserId,
    listConversationReviewSnapshotsByTraceId: conversationReviewSnapshotsRepo.listConversationReviewSnapshotsByTraceId,
    buildConversationReviewUnitsFromSources,
    queryLatestPatrolInsights,
    sleep
  }, overrideDeps || {});
  if (!overrideDeps) {
    deps.getLlmActionLogByRequestId = llmActionLogsRepo.getLlmActionLogByRequestId;
  } else if (hasOwn(overrideDeps, 'getLlmActionLogByRequestId')) {
    deps.getLlmActionLogByRequestId = overrideDeps.getLlmActionLogByRequestId;
  } else {
    deps.getLlmActionLogByRequestId = null;
  }

  const startedAt = new Date();
  const fromAt = new Date(startedAt.getTime() - 60 * 1000).toISOString();
  const events = [];
  for (let index = 0; index < options.messages.length; index += 1) {
    const stamp = `${Date.now()}_${index}`;
    const requestId = `${options.prefix}_${stamp}`;
    const suppliedTraceId = `${options.prefix}_trace_${stamp}`;
    const outboundReplyTexts = [];
    const event = buildReplayEvent({
      requestId,
      lineUserId: options.userId,
      text: options.messages[index],
      timestamp: Date.now(),
      webhookEventId: `evt_${requestId}`,
      messageId: `msg_${requestId}`,
      replyToken: `reply_${requestId}`
    });
    const trustedPayload = validateTrustedWebhookBody(buildTrustedWebhookBody(event, { destination: options.destination }));
    const response = await deps.handleLineWebhook({
      trustedPayload,
      requestId,
      traceId: suppliedTraceId,
      allowWelcome: false,
      logger: () => {},
      replyFn: async (_replyToken, message) => {
        outboundReplyTexts.push(...normalizeOutbound(message));
        return { status: 200 };
      },
      pushFn: async (_lineUserId, message) => {
        outboundReplyTexts.push(...normalizeOutbound(message));
        return { status: 200 };
      },
      sendWelcomeFn: async () => ({ status: 200 })
    });
    const actionLogResult = await findPersistedActionLog({
      requestId,
      lineUserId: options.userId,
      fromAt,
      pollAttempts: options.pollAttempts,
      pollIntervalMs: options.pollIntervalMs
    }, deps);
    const row = actionLogResult.row;
    const persistedTraceKey = row && row.traceId ? row.traceId : null;
    const suppliedTraceSnapshots = await deps.listConversationReviewSnapshotsByTraceId({ traceId: suppliedTraceId, limit: 20 });
    const persistedTraceSnapshots = persistedTraceKey
      ? await deps.listConversationReviewSnapshotsByTraceId({ traceId: persistedTraceKey, limit: 20 })
      : [];
    events.push({
      index,
      requestId,
      suppliedTraceId,
      persistedTraceKey,
      responseStatus: response && response.status ? response.status : null,
      pollAttemptsUsed: actionLogResult.attempts,
      outboundReplyCount: outboundReplyTexts.length,
      transcriptSnapshotOutcome: row ? row.transcriptSnapshotOutcome ?? null : null,
      transcriptSnapshotReason: row ? row.transcriptSnapshotReason ?? null : null,
      transcriptSnapshotAssistantReplyPresent: row ? row.transcriptSnapshotAssistantReplyPresent ?? null : null,
      transcriptSnapshotAssistantReplyLength: row ? row.transcriptSnapshotAssistantReplyLength ?? null : null,
      transcriptSnapshotSanitizedReplyLength: row ? row.transcriptSnapshotSanitizedReplyLength ?? null : null,
      transcriptSnapshotBuildAttempted: row ? row.transcriptSnapshotBuildAttempted ?? null : null,
      transcriptSnapshotBuildSkippedReason: row ? row.transcriptSnapshotBuildSkippedReason ?? null : null,
      snapshotRowsBySuppliedTraceId: suppliedTraceSnapshots.length,
      snapshotRowsByPersistedTraceKey: persistedTraceSnapshots.length
    });
    await deps.sleep(500);
  }
  const toAt = new Date(Date.now() + 1000).toISOString();
  const recentSummary = await buildRecentSummary({ fromAt, toAt }, deps);
  const result = {
    replayVersion: REPLAY_VERSION,
    checkedAt: new Date().toISOString(),
    lineUserIdMasked: maskLineUserId(options.userId),
    destination: options.destination,
    replayRequestPrefix: options.prefix,
    replayCount: events.length,
    recentWindow: { fromAt, toAt },
    events,
    recentSummary,
    writePath: {
      webhookEntrypoint: 'src/routes/webhookLine.js#handleLineWebhook',
      stubsUsed: ['replyFn', 'pushFn', 'sendWelcomeFn'],
      rawPersistenceAdded: false
    }
  };
  writeJson(options.output, result);
  return result;
}

async function main() {
  const options = parseReplayArgs(process.argv);
  const result = await replaySameTrafficSet(options);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    outputPath: options.output,
    replayCount: result.replayCount,
    recentWindow: result.recentWindow,
    recentWritten: result.recentSummary && result.recentSummary.ok ? result.recentSummary.written : null
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      code: normalizeString(error && error.code, 'quality_patrol_replay_failed'),
      error: normalizeString(error && error.message, String(error))
    }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  REPLAY_VERSION,
  DEFAULT_USER_ID,
  DEFAULT_MESSAGES,
  buildReplayEvent,
  buildTrustedWebhookBody,
  validateTrustedWebhookBody,
  parseReplayArgs,
  replaySameTrafficSet,
  normalizeOutbound,
  maskLineUserId
};
