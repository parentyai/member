'use strict';

const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { computeDashboardKpis } = require('../../routes/admin/osDashboardKpi');
const { getUserOperationalSummary } = require('./getUserOperationalSummary');
const { getUserStateSummary } = require('../phase5/getUserStateSummary');

const ALLOWED_WINDOWS = new Set([1, 3, 6, 12]);
const DEFAULT_WINDOWS = Object.freeze([1, 3, 6, 12]);

function normalizeWindows(value) {
  if (!Array.isArray(value) || !value.length) return Array.from(DEFAULT_WINDOWS);
  const out = [];
  value.forEach((item) => {
    const num = Number(item);
    if (!Number.isFinite(num)) return;
    const normalized = Math.max(1, Math.min(12, Math.floor(num)));
    if (!ALLOWED_WINDOWS.has(normalized)) return;
    if (out.includes(normalized)) return;
    out.push(normalized);
  });
  return out.length ? out : Array.from(DEFAULT_WINDOWS);
}

function normalizeLineUserIds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 200);
}

function normalizeScanLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 2000;
  return Math.max(100, Math.min(3000, Math.floor(num)));
}

async function buildOpsSnapshots(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const actor = typeof payload.actor === 'string' && payload.actor.trim() ? payload.actor.trim() : 'ops_snapshot_job';
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim() ? payload.requestId.trim() : null;
  const dryRun = payload.dryRun === true;
  const windows = normalizeWindows(payload.windowMonths);
  const lineUserIds = normalizeLineUserIds(payload.lineUserIds);
  const scanLimit = normalizeScanLimit(payload.scanLimit);

  const asOf = new Date().toISOString();
  const items = [];

  for (const windowMonths of windows) {
    const computed = await computeDashboardKpis(windowMonths, scanLimit);
    const snapshotPayload = {
      snapshotType: 'dashboard_kpi',
      snapshotKey: String(windowMonths),
      asOf: computed.asOf || asOf,
      freshnessMinutes: 60,
      sourceTraceId: traceId,
      data: {
        kpis: computed.kpis,
        windowMonths,
        scanLimit
      }
    };
    if (!dryRun) await opsSnapshotsRepo.saveSnapshot(snapshotPayload);
    items.push({ snapshotType: 'dashboard_kpi', snapshotKey: String(windowMonths), dryRun });
  }

  const userSummary = await getUserOperationalSummary({ analyticsLimit: scanLimit, useSnapshot: false });
  const userSummaryPayload = {
    snapshotType: 'user_operational_summary',
    snapshotKey: 'latest',
    asOf,
    freshnessMinutes: 60,
    sourceTraceId: traceId,
    data: {
      items: userSummary
    }
  };
  if (!dryRun) await opsSnapshotsRepo.saveSnapshot(userSummaryPayload);
  items.push({ snapshotType: 'user_operational_summary', snapshotKey: 'latest', dryRun });

  for (const lineUserId of lineUserIds) {
    const state = await getUserStateSummary({ lineUserId, analyticsLimit: scanLimit, useSnapshot: false });
    const userStatePayload = {
      snapshotType: 'user_state_summary',
      snapshotKey: lineUserId,
      asOf,
      freshnessMinutes: 60,
      sourceTraceId: traceId,
      data: state
    };
    if (!dryRun) await opsSnapshotsRepo.saveSnapshot(userStatePayload);
    items.push({ snapshotType: 'user_state_summary', snapshotKey: lineUserId, dryRun });
  }

  const summary = {
    dryRun,
    windows,
    lineUserIds: lineUserIds.length,
    scanLimit,
    snapshotsBuilt: items.length,
    asOf
  };

  await appendAuditLog({
    actor,
    action: dryRun ? 'ops_snapshot.build.dry_run' : 'ops_snapshot.build.execute',
    entityType: 'ops_snapshot',
    entityId: 'global',
    traceId: traceId || undefined,
    requestId: requestId || undefined,
    payloadSummary: summary
  });

  return {
    ok: true,
    traceId,
    requestId,
    summary,
    items
  };
}

module.exports = {
  buildOpsSnapshots
};
