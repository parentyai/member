'use strict';

const { appendAuditLog } = require('../audit/appendAuditLog');
const {
  listCanonicalCoreOutboxEvents,
  markCanonicalCoreOutboxEventSynced,
  markCanonicalCoreOutboxEventFailed
} = require('../../repos/firestore/canonicalCoreOutboxRepo');
const { upsertCanonicalCoreObject } = require('../../domain/data/canonicalCorePostgresSink');

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(num), MAX_LIMIT);
}

function normalizeDryRun(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeText(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value.trim();
}

async function runCanonicalCoreOutboxSyncJob(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const runtimeDeps = deps && typeof deps === 'object' ? deps : {};
  const actor = normalizeText(payload.actor, 'canonical_core_outbox_sync_job');
  const traceId = normalizeText(payload.traceId, null);
  const requestId = normalizeText(payload.requestId, null);
  const dryRun = normalizeDryRun(payload.dryRun);
  const limit = normalizeLimit(payload.limit);
  const startedAt = Date.now();

  const listEvents = typeof runtimeDeps.listEvents === 'function'
    ? runtimeDeps.listEvents
    : listCanonicalCoreOutboxEvents;
  const upsertEvent = typeof runtimeDeps.upsertEvent === 'function'
    ? runtimeDeps.upsertEvent
    : upsertCanonicalCoreObject;
  const markSynced = typeof runtimeDeps.markSynced === 'function'
    ? runtimeDeps.markSynced
    : markCanonicalCoreOutboxEventSynced;
  const markFailed = typeof runtimeDeps.markFailed === 'function'
    ? runtimeDeps.markFailed
    : markCanonicalCoreOutboxEventFailed;
  const appendAudit = typeof runtimeDeps.appendAuditLog === 'function'
    ? runtimeDeps.appendAuditLog
    : appendAuditLog;

  const pending = await listEvents({ status: 'pending', limit });
  const result = {
    ok: true,
    dryRun,
    limit,
    scannedCount: Array.isArray(pending) ? pending.length : 0,
    syncedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    typedMaterializedCount: 0,
    typedSkippedCount: 0,
    skippedReasonCounts: {},
    items: []
  };

  const rows = Array.isArray(pending) ? pending : [];
  for (const row of rows) {
    const event = row && typeof row === 'object' ? row : {};
    const eventId = normalizeText(event.id, null);
    if (!eventId) continue;

    if (dryRun) {
      result.items.push({
        id: eventId,
        objectType: event.objectType || null,
        objectId: event.objectId || null,
        eventType: event.eventType || null,
        sinkStatus: event.sinkStatus || null,
        outcome: 'dry_run'
      });
      continue;
    }

    try {
      const sinkResult = await upsertEvent(event, runtimeDeps.sinkDeps);
      if (sinkResult && sinkResult.skipped === true) {
        result.skippedCount += 1;
        const reason = normalizeText(sinkResult.reason, 'sink_skipped');
        result.skippedReasonCounts[reason] = (result.skippedReasonCounts[reason] || 0) + 1;
        result.items.push({
          id: eventId,
          objectType: event.objectType || null,
          objectId: event.objectId || null,
          eventType: event.eventType || null,
          sinkStatus: event.sinkStatus || null,
          outcome: 'skipped',
          reason
        });
        continue;
      }

      await markSynced(eventId, {
        canonicalRecordId: sinkResult && sinkResult.canonicalRecordId
          ? String(sinkResult.canonicalRecordId)
          : null,
        typedMaterialization: sinkResult && sinkResult.typedMaterialization
          ? sinkResult.typedMaterialization
          : null
      });
      const typedTables = sinkResult && sinkResult.typedMaterialization && Array.isArray(sinkResult.typedMaterialization.tables)
        ? sinkResult.typedMaterialization.tables
        : [];
      result.typedMaterializedCount += typedTables.filter((row) => row && row.status === 'materialized').length;
      result.typedSkippedCount += typedTables.filter((row) => row && row.status === 'skipped').length;
      result.syncedCount += 1;
      result.items.push({
        id: eventId,
        objectType: event.objectType || null,
        objectId: event.objectId || null,
        eventType: event.eventType || null,
        outcome: 'synced',
        canonicalRecordId: sinkResult && sinkResult.canonicalRecordId
          ? String(sinkResult.canonicalRecordId)
          : null,
        typedMaterialization: sinkResult && sinkResult.typedMaterialization
          ? sinkResult.typedMaterialization
          : null
      });
    } catch (error) {
      result.failedCount += 1;
      await markFailed(eventId, error).catch(() => null);
      result.items.push({
        id: eventId,
        objectType: event.objectType || null,
        objectId: event.objectId || null,
        eventType: event.eventType || null,
        outcome: 'failed',
        errorCode: normalizeText(error && error.code, 'canonical_core_sync_failed')
      });
    }
  }

  if (!dryRun && result.failedCount > 0) {
    result.ok = false;
  }
  result.durationMs = Math.max(0, Date.now() - startedAt);

  await appendAudit({
    actor,
    action: 'canonical_core.outbox.sync',
    entityType: 'canonical_core_outbox',
    entityId: 'global',
    traceId,
    requestId,
    payloadSummary: {
      dryRun,
      limit,
      scannedCount: result.scannedCount,
      syncedCount: result.syncedCount,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
      typedMaterializedCount: result.typedMaterializedCount,
      typedSkippedCount: result.typedSkippedCount,
      skippedReasonCounts: result.skippedReasonCounts
    }
  }).catch(() => null);

  return result;
}

module.exports = {
  runCanonicalCoreOutboxSyncJob
};
