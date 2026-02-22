'use strict';

const fs = require('fs');
const path = require('path');

const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveSnapshotFreshnessMinutes } = require('../../domain/readModel/snapshotReadPolicy');
const { READ_PATH_FALLBACK_ACTIONS } = require('./readPathFallbackSummary');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const LOAD_RISK_PATH = path.join(ROOT_DIR, 'docs', 'REPO_AUDIT_INPUTS', 'load_risk.json');
const READ_PATH_BUDGETS_PATH = path.join(ROOT_DIR, 'docs', 'READ_PATH_BUDGETS.md');

function parseWindowHours(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('windowHours'));
  if (!Number.isFinite(raw) || raw <= 0) return 24;
  return Math.min(Math.floor(raw), 24 * 30);
}

function parseStaleAfterMinutes(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('staleAfterMinutes'));
  if (!Number.isFinite(raw) || raw <= 0) {
    return resolveSnapshotFreshnessMinutes({});
  }
  return resolveSnapshotFreshnessMinutes({ freshnessMinutes: raw });
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function parseCurrentBudgets() {
  if (!fs.existsSync(READ_PATH_BUDGETS_PATH)) {
    return { worstCaseMax: null, fallbackPointsMax: null, hotspotsCountMax: null };
  }
  const text = fs.readFileSync(READ_PATH_BUDGETS_PATH, 'utf8');
  const worstMatches = [...text.matchAll(/worst_case_docs_scan_max:\s*(\d+)/g)];
  const fallbackMatches = [...text.matchAll(/fallback_points_max:\s*(\d+)/g)];
  const hotspotMatches = [...text.matchAll(/hotspots_count_max:\s*(\d+)/g)];
  const worstMatch = worstMatches.length ? worstMatches[worstMatches.length - 1] : null;
  const fallbackMatch = fallbackMatches.length ? fallbackMatches[fallbackMatches.length - 1] : null;
  const hotspotMatch = hotspotMatches.length ? hotspotMatches[hotspotMatches.length - 1] : null;
  return {
    worstCaseMax: worstMatch ? Number(worstMatch[1]) : null,
    fallbackPointsMax: fallbackMatch ? Number(fallbackMatch[1]) : null,
    hotspotsCountMax: hotspotMatch ? Number(hotspotMatch[1]) : null
  };
}

function readLoadRisk() {
  if (!fs.existsSync(LOAD_RISK_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(LOAD_RISK_PATH, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function isSnapshotStale(row, staleAfterMinutes) {
  const asOfMs = toMillis(row && row.asOf);
  if (!Number.isFinite(asOfMs) || asOfMs <= 0) return true;
  return (Date.now() - asOfMs) > staleAfterMinutes * 60 * 1000;
}

async function countFallbackRows(windowHours) {
  const perActionLimit = 200;
  const grouped = await Promise.all(READ_PATH_FALLBACK_ACTIONS.map((action) => auditLogsRepo.listAuditLogs({
    action,
    limit: perActionLimit
  })));
  const sinceMs = Date.now() - (windowHours * 60 * 60 * 1000);
  return grouped
    .flat()
    .filter((row) => READ_PATH_FALLBACK_ACTIONS.includes(row && row.action))
    .filter((row) => toMillis(row && row.createdAt) >= sinceMs)
    .length;
}

async function handleProductReadiness(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const windowHours = parseWindowHours(req);
  const staleAfterMinutes = parseStaleAfterMinutes(req);

  try {
    const [killSwitch, snapshots, fallbackEventsCount] = await Promise.all([
      systemFlagsRepo.getKillSwitch(),
      opsSnapshotsRepo.listSnapshots({ limit: 200 }),
      countFallbackRows(windowHours)
    ]);

    const loadRisk = readLoadRisk();
    const budgets = parseCurrentBudgets();
    const fallbackSpikeMax = Number.isFinite(Number(process.env.READ_PATH_FALLBACK_SPIKE_MAX))
      ? Number(process.env.READ_PATH_FALLBACK_SPIKE_MAX)
      : 200;

    const staleCount = (snapshots || []).filter((row) => isSnapshotStale(row, staleAfterMinutes)).length;
    const snapshotCount = Array.isArray(snapshots) ? snapshots.length : 0;
    const staleRatio = snapshotCount > 0 ? staleCount / snapshotCount : 1;

    const blockers = [];

    if (killSwitch) {
      blockers.push({ code: 'kill_switch_on', message: 'Kill Switch is ON' });
    }

    if (!loadRisk) {
      blockers.push({ code: 'load_risk_missing', message: 'load_risk.json is not available' });
    } else {
      if (Number.isFinite(budgets.worstCaseMax)
        && Number(loadRisk.estimated_worst_case_docs_scan) > budgets.worstCaseMax) {
        blockers.push({
          code: 'load_risk_worst_case_over_budget',
          message: 'worst_case_docs_scan exceeds budget',
          value: Number(loadRisk.estimated_worst_case_docs_scan),
          budget: budgets.worstCaseMax
        });
      }
      if (Number.isFinite(budgets.fallbackPointsMax)
        && Number(loadRisk.fallback_risk) > budgets.fallbackPointsMax) {
        blockers.push({
          code: 'load_risk_fallback_over_budget',
          message: 'fallback_risk exceeds budget',
          value: Number(loadRisk.fallback_risk),
          budget: budgets.fallbackPointsMax
        });
      }
      if (Number.isFinite(budgets.hotspotsCountMax)
        && Array.isArray(loadRisk.hotspots)
        && loadRisk.hotspots.length > budgets.hotspotsCountMax) {
        blockers.push({
          code: 'load_risk_hotspots_over_budget',
          message: 'hotspots_count exceeds budget',
          value: loadRisk.hotspots.length,
          budget: budgets.hotspotsCountMax
        });
      }
    }

    if (snapshotCount === 0) {
      blockers.push({ code: 'snapshot_missing', message: 'ops snapshots are missing' });
    } else if (staleRatio > 0.5) {
      blockers.push({
        code: 'snapshot_stale_ratio_high',
        message: 'snapshot stale ratio is above threshold',
        value: staleRatio,
        threshold: 0.5
      });
    }

    if (fallbackEventsCount > fallbackSpikeMax) {
      blockers.push({
        code: 'fallback_spike_detected',
        message: 'read-path fallback events exceed spike threshold',
        value: fallbackEventsCount,
        threshold: fallbackSpikeMax
      });
    }

    const status = blockers.length === 0 ? 'GO' : 'NO_GO';

    try {
      await appendAuditLog({
        actor,
        action: 'product_readiness.view',
        entityType: 'release',
        entityId: 'product_out',
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        payloadSummary: {
          status,
          blockerCount: blockers.length,
          windowHours,
          staleAfterMinutes,
          fallbackEventsCount
        }
      });
    } catch (auditErr) {
      logRouteError('admin.product_readiness.audit', auditErr, { actor, traceId, requestId });
    }

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      status,
      blockers,
      checks: {
        killSwitch: { ok: !killSwitch, value: killSwitch },
        loadRisk: {
          ok: blockers.every((item) => !String(item.code).startsWith('load_risk_')),
          value: loadRisk || null,
          budget: budgets
        },
        snapshotHealth: {
          ok: snapshotCount > 0 && staleRatio <= 0.5,
          snapshotCount,
          staleCount,
          staleRatio,
          staleAfterMinutes
        },
        fallbackSpikes: {
          ok: fallbackEventsCount <= fallbackSpikeMax,
          count: fallbackEventsCount,
          threshold: fallbackSpikeMax,
          windowHours
        }
      }
    }));
  } catch (err) {
    logRouteError('admin.product_readiness.view', err, { actor, traceId, requestId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleProductReadiness
};
