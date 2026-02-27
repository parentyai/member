'use strict';

const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { computeDashboardKpis } = require('../../routes/admin/osDashboardKpi');
const { getUserOperationalSummary } = require('./getUserOperationalSummary');
const { getNotificationOperationalSummary } = require('./getNotificationOperationalSummary');
const { getUserStateSummary } = require('../phase5/getUserStateSummary');
const { computeOpsSystemSnapshot } = require('./opsSnapshot/computeOpsSystemSnapshot');

const ALLOWED_WINDOWS = new Set([1, 3, 6, 12, 36]);
const DEFAULT_WINDOWS = Object.freeze([1, 3, 6, 12, 36]);
const SNAPSHOT_TARGETS = Object.freeze([
  'dashboard_kpi',
  'user_operational_summary',
  'notification_operational_summary',
  'user_state_summary',
  'ops_system_snapshot'
]);
const SNAPSHOT_TARGET_SET = new Set(SNAPSHOT_TARGETS);

function normalizeWindows(value) {
  if (!Array.isArray(value) || !value.length) return Array.from(DEFAULT_WINDOWS);
  const out = [];
  value.forEach((item) => {
    const num = Number(item);
    if (!Number.isFinite(num)) return;
    const normalized = Math.max(1, Math.min(36, Math.floor(num)));
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

function normalizeTargets(value) {
  if (!Array.isArray(value) || value.length === 0) return Array.from(SNAPSHOT_TARGETS);
  const out = [];
  value.forEach((item) => {
    if (typeof item !== 'string') return;
    const target = item.trim();
    if (!SNAPSHOT_TARGET_SET.has(target)) return;
    if (out.includes(target)) return;
    out.push(target);
  });
  return out.length ? out : Array.from(SNAPSHOT_TARGETS);
}

function hasTarget(targets, key) {
  return Array.isArray(targets) && targets.includes(key);
}

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  return defaultValue === true;
}

function resolveOpsSystemSnapshotEnabled() {
  return resolveBooleanEnvFlag('ENABLE_OPS_SYSTEM_SNAPSHOT_V1', true);
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
  const targets = normalizeTargets(payload.targets);
  const opsSystemSnapshotEnabled = resolveOpsSystemSnapshotEnabled();
  const skippedTargets = [];

  const asOf = new Date().toISOString();
  const items = [];

  if (hasTarget(targets, 'dashboard_kpi')) {
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
  }

  if (hasTarget(targets, 'user_operational_summary')) {
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
  }

  if (hasTarget(targets, 'notification_operational_summary')) {
    const notificationSummary = await getNotificationOperationalSummary({
      limit: scanLimit,
      eventsLimit: scanLimit,
      useSnapshot: false
    });
    const notificationSummaryPayload = {
      snapshotType: 'notification_operational_summary',
      snapshotKey: 'latest',
      asOf,
      freshnessMinutes: 60,
      sourceTraceId: traceId,
      data: {
        items: notificationSummary
      }
    };
    if (!dryRun) await opsSnapshotsRepo.saveSnapshot(notificationSummaryPayload);
    items.push({ snapshotType: 'notification_operational_summary', snapshotKey: 'latest', dryRun });
  }

  if (hasTarget(targets, 'user_state_summary')) {
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
  }

  if (hasTarget(targets, 'ops_system_snapshot')) {
    if (!opsSystemSnapshotEnabled) {
      skippedTargets.push('ops_system_snapshot');
    } else {
      const computed = await computeOpsSystemSnapshot({
        scanLimit,
        traceId,
        requestId,
        asOf
      });
      const snapshotAsOf = computed && computed.nowIso ? computed.nowIso : asOf;
      const global = computed && computed.global && typeof computed.global === 'object'
        ? computed.global
        : null;
      const catalog = computed && computed.catalog && typeof computed.catalog === 'object'
        ? computed.catalog
        : null;
      const rows = Array.isArray(computed && computed.rows) ? computed.rows : [];

      const globalPayload = {
        snapshotType: 'ops_system_snapshot',
        snapshotKey: 'global',
        asOf: snapshotAsOf,
        freshnessMinutes: 5,
        sourceTraceId: traceId,
        data: global
      };
      if (!dryRun) await opsSnapshotsRepo.saveSnapshot(globalPayload);
      items.push({ snapshotType: 'ops_system_snapshot', snapshotKey: 'global', dryRun });

      const catalogPayload = {
        snapshotType: 'ops_feature_status',
        snapshotKey: 'catalog',
        asOf: snapshotAsOf,
        freshnessMinutes: 5,
        sourceTraceId: traceId,
        data: catalog
      };
      if (!dryRun) await opsSnapshotsRepo.saveSnapshot(catalogPayload);
      items.push({ snapshotType: 'ops_feature_status', snapshotKey: 'catalog', dryRun });

      for (const row of rows) {
        const featureId = row && typeof row.featureId === 'string' && row.featureId.trim()
          ? row.featureId.trim()
          : null;
        if (!featureId) continue;
        const rowPayload = {
          snapshotType: 'ops_feature_status',
          snapshotKey: featureId,
          asOf: snapshotAsOf,
          freshnessMinutes: 5,
          sourceTraceId: traceId,
          data: row
        };
        if (!dryRun) await opsSnapshotsRepo.saveSnapshot(rowPayload);
        items.push({ snapshotType: 'ops_feature_status', snapshotKey: featureId, dryRun });
      }
    }
  }

  const summary = {
    dryRun,
    windows,
    targets,
    skippedTargets,
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
