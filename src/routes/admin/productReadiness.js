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
const MISSING_INDEX_SURFACE_PATH = path.join(ROOT_DIR, 'docs', 'REPO_AUDIT_INPUTS', 'missing_index_surface.json');
const RETENTION_RISK_PATH = path.join(ROOT_DIR, 'docs', 'REPO_AUDIT_INPUTS', 'retention_risk.json');
const RETENTION_BUDGETS_PATH = path.join(ROOT_DIR, 'docs', 'RETENTION_BUDGETS.md');
const STRUCTURE_RISK_PATH = path.join(ROOT_DIR, 'docs', 'REPO_AUDIT_INPUTS', 'structure_risk.json');
const STRUCTURE_BUDGETS_PATH = path.join(ROOT_DIR, 'docs', 'STRUCTURE_BUDGETS.md');
const DEPENDENCY_GRAPH_PATH = path.join(ROOT_DIR, 'docs', 'REPO_AUDIT_INPUTS', 'dependency_graph.json');

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
    return {
      worstCaseMax: null,
      fallbackPointsMax: null,
      hotspotsCountMax: null,
      missingIndexSurfaceMax: null,
      loadRiskFreshnessMaxHours: null,
      missingIndexSurfaceFreshnessMaxHours: null
    };
  }
  const text = fs.readFileSync(READ_PATH_BUDGETS_PATH, 'utf8');
  const worstMatches = [...text.matchAll(/worst_case_docs_scan_max:\s*(\d+)/g)];
  const fallbackMatches = [...text.matchAll(/fallback_points_max:\s*(\d+)/g)];
  const hotspotMatches = [...text.matchAll(/hotspots_count_max:\s*(\d+)/g)];
  const missingIndexMatches = [...text.matchAll(/missing_index_surface_max:\s*(\d+)/g)];
  const loadRiskFreshnessMatches = [...text.matchAll(/load_risk_freshness_max_hours:\s*(\d+)/g)];
  const missingIndexFreshnessMatches = [...text.matchAll(/missing_index_surface_freshness_max_hours:\s*(\d+)/g)];
  const snapshotStaleRatioMatches = [...text.matchAll(/snapshot_stale_ratio_max:\s*([0-9]+(?:\.[0-9]+)?)/g)];
  const fallbackSpikeMatches = [...text.matchAll(/fallback_spike_max:\s*(\d+)/g)];
  const worstMatch = worstMatches.length ? worstMatches[worstMatches.length - 1] : null;
  const fallbackMatch = fallbackMatches.length ? fallbackMatches[fallbackMatches.length - 1] : null;
  const hotspotMatch = hotspotMatches.length ? hotspotMatches[hotspotMatches.length - 1] : null;
  const missingIndexMatch = missingIndexMatches.length ? missingIndexMatches[missingIndexMatches.length - 1] : null;
  const loadRiskFreshnessMatch = loadRiskFreshnessMatches.length ? loadRiskFreshnessMatches[loadRiskFreshnessMatches.length - 1] : null;
  const missingIndexFreshnessMatch = missingIndexFreshnessMatches.length
    ? missingIndexFreshnessMatches[missingIndexFreshnessMatches.length - 1]
    : null;
  const snapshotStaleRatioMatch = snapshotStaleRatioMatches.length
    ? snapshotStaleRatioMatches[snapshotStaleRatioMatches.length - 1]
    : null;
  const fallbackSpikeMatch = fallbackSpikeMatches.length ? fallbackSpikeMatches[fallbackSpikeMatches.length - 1] : null;
  return {
    worstCaseMax: worstMatch ? Number(worstMatch[1]) : null,
    fallbackPointsMax: fallbackMatch ? Number(fallbackMatch[1]) : null,
    hotspotsCountMax: hotspotMatch ? Number(hotspotMatch[1]) : null,
    missingIndexSurfaceMax: missingIndexMatch ? Number(missingIndexMatch[1]) : null,
    loadRiskFreshnessMaxHours: loadRiskFreshnessMatch ? Number(loadRiskFreshnessMatch[1]) : null,
    missingIndexSurfaceFreshnessMaxHours: missingIndexFreshnessMatch ? Number(missingIndexFreshnessMatch[1]) : null,
    snapshotStaleRatioMax: snapshotStaleRatioMatch ? Number(snapshotStaleRatioMatch[1]) : null,
    fallbackSpikeMax: fallbackSpikeMatch ? Number(fallbackSpikeMatch[1]) : null
  };
}

function parseRetentionBudgets() {
  if (!fs.existsSync(RETENTION_BUDGETS_PATH)) {
    return {
      undefinedRetentionMax: null,
      undefinedDeletableConditionalMax: null,
      undefinedRecomputableMax: null,
      retentionRiskFreshnessMaxHours: null
    };
  }
  const text = fs.readFileSync(RETENTION_BUDGETS_PATH, 'utf8');
  const undefinedRetentionMatches = [...text.matchAll(/undefined_retention_max:\s*(\d+)/g)];
  const undefinedConditionalMatches = [...text.matchAll(/undefined_deletable_conditional_max:\s*(\d+)/g)];
  const undefinedRecomputableMatches = [...text.matchAll(/undefined_recomputable_max:\s*(\d+)/g)];
  const retentionRiskFreshnessMatches = [...text.matchAll(/retention_risk_freshness_max_hours:\s*(\d+)/g)];
  const undefinedRetentionMatch = undefinedRetentionMatches.length
    ? undefinedRetentionMatches[undefinedRetentionMatches.length - 1]
    : null;
  const undefinedConditionalMatch = undefinedConditionalMatches.length
    ? undefinedConditionalMatches[undefinedConditionalMatches.length - 1]
    : null;
  const undefinedRecomputableMatch = undefinedRecomputableMatches.length
    ? undefinedRecomputableMatches[undefinedRecomputableMatches.length - 1]
    : null;
  const retentionRiskFreshnessMatch = retentionRiskFreshnessMatches.length
    ? retentionRiskFreshnessMatches[retentionRiskFreshnessMatches.length - 1]
    : null;
  return {
    undefinedRetentionMax: undefinedRetentionMatch ? Number(undefinedRetentionMatch[1]) : null,
    undefinedDeletableConditionalMax: undefinedConditionalMatch ? Number(undefinedConditionalMatch[1]) : null,
    undefinedRecomputableMax: undefinedRecomputableMatch ? Number(undefinedRecomputableMatch[1]) : null,
    retentionRiskFreshnessMaxHours: retentionRiskFreshnessMatch ? Number(retentionRiskFreshnessMatch[1]) : null
  };
}

function parseStructureBudgets() {
  if (!fs.existsSync(STRUCTURE_BUDGETS_PATH)) {
    return {
      legacyReposMax: null,
      mergeCandidatesMax: null,
      namingDriftScenarioMax: null,
      unresolvedDynamicDepMax: null,
      structureRiskFreshnessMaxHours: null,
      activeLegacyRepoImportsMax: null
    };
  }
  const text = fs.readFileSync(STRUCTURE_BUDGETS_PATH, 'utf8');
  const legacyReposMatches = [...text.matchAll(/legacy_repos_max:\s*(\d+)/g)];
  const mergeCandidatesMatches = [...text.matchAll(/merge_candidates_max:\s*(\d+)/g)];
  const namingDriftScenarioMatches = [...text.matchAll(/naming_drift_scenario_max:\s*(\d+)/g)];
  const unresolvedDynamicDepMatches = [...text.matchAll(/unresolved_dynamic_dep_max:\s*(\d+)/g)];
  const activeLegacyRepoImportsMatches = [...text.matchAll(/active_legacy_repo_imports_max:\s*(\d+)/g)];
  const freshnessMatches = [...text.matchAll(/structure_risk_freshness_max_hours:\s*(\d+)/g)];
  const legacyReposMatch = legacyReposMatches.length ? legacyReposMatches[legacyReposMatches.length - 1] : null;
  const mergeCandidatesMatch = mergeCandidatesMatches.length
    ? mergeCandidatesMatches[mergeCandidatesMatches.length - 1]
    : null;
  const namingDriftScenarioMatch = namingDriftScenarioMatches.length
    ? namingDriftScenarioMatches[namingDriftScenarioMatches.length - 1]
    : null;
  const unresolvedDynamicDepMatch = unresolvedDynamicDepMatches.length
    ? unresolvedDynamicDepMatches[unresolvedDynamicDepMatches.length - 1]
    : null;
  const activeLegacyRepoImportsMatch = activeLegacyRepoImportsMatches.length
    ? activeLegacyRepoImportsMatches[activeLegacyRepoImportsMatches.length - 1]
    : null;
  const freshnessMatch = freshnessMatches.length ? freshnessMatches[freshnessMatches.length - 1] : null;
  return {
    legacyReposMax: legacyReposMatch ? Number(legacyReposMatch[1]) : null,
    mergeCandidatesMax: mergeCandidatesMatch ? Number(mergeCandidatesMatch[1]) : null,
    namingDriftScenarioMax: namingDriftScenarioMatch ? Number(namingDriftScenarioMatch[1]) : null,
    unresolvedDynamicDepMax: unresolvedDynamicDepMatch ? Number(unresolvedDynamicDepMatch[1]) : null,
    structureRiskFreshnessMaxHours: freshnessMatch ? Number(freshnessMatch[1]) : null,
    activeLegacyRepoImportsMax: activeLegacyRepoImportsMatch ? Number(activeLegacyRepoImportsMatch[1]) : null
  };
}

function parseGeneratedAtHours(value) {
  if (!value || value === 'NOT AVAILABLE' || value === 'NOT_AVAILABLE') return Number.NaN;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return Number.NaN;
  return (Date.now() - ms) / (60 * 60 * 1000);
}

function readLoadRisk() {
  if (!fs.existsSync(LOAD_RISK_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(LOAD_RISK_PATH, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function readMissingIndexSurface() {
  if (!fs.existsSync(MISSING_INDEX_SURFACE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MISSING_INDEX_SURFACE_PATH, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function readRetentionRisk() {
  if (!fs.existsSync(RETENTION_RISK_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(RETENTION_RISK_PATH, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function readStructureRisk() {
  if (!fs.existsSync(STRUCTURE_RISK_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(STRUCTURE_RISK_PATH, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function readDependencyGraph() {
  if (!fs.existsSync(DEPENDENCY_GRAPH_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(DEPENDENCY_GRAPH_PATH, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function countActiveLegacyRepoImports(structureRisk, dependencyGraph) {
  const payload = dependencyGraph && typeof dependencyGraph === 'object' ? dependencyGraph : {};
  const usecaseToRepo = payload.usecase_to_repo && typeof payload.usecase_to_repo === 'object'
    ? payload.usecase_to_repo
    : {};
  const legacyRepos = Array.isArray(structureRisk && structureRisk.legacy_repos)
    ? structureRisk.legacy_repos
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
    : [];
  if (!legacyRepos.length) return 0;
  const legacySet = new Set(legacyRepos);
  let count = 0;
  Object.values(usecaseToRepo).forEach((repos) => {
    if (!Array.isArray(repos)) return;
    repos.forEach((repoName) => {
      if (typeof repoName !== 'string') return;
      if (!legacySet.has(repoName.trim())) return;
      count += 1;
    });
  });
  return count;
}

function isSnapshotStale(row, staleAfterMinutes) {
  const asOfMs = toMillis(row && row.asOf);
  if (!Number.isFinite(asOfMs) || asOfMs <= 0) return true;
  return (Date.now() - asOfMs) > staleAfterMinutes * 60 * 1000;
}

function isSnapshotRefreshJobConfigured() {
  return typeof process.env.CITY_PACK_JOB_TOKEN === 'string'
    && process.env.CITY_PACK_JOB_TOKEN.trim().length > 0;
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
    const missingIndexSurface = readMissingIndexSurface();
    const retentionRisk = readRetentionRisk();
    const structureRisk = readStructureRisk();
    const dependencyGraph = readDependencyGraph();
    const budgets = parseCurrentBudgets();
    const retentionBudgets = parseRetentionBudgets();
    const structureBudgets = parseStructureBudgets();
    const loadRiskFreshnessMaxHours = budgets.loadRiskFreshnessMaxHours;
    const missingIndexSurfaceFreshnessMaxHours = budgets.missingIndexSurfaceFreshnessMaxHours;
    const retentionRiskFreshnessMaxHours = Number.isFinite(Number(process.env.READINESS_RETENTION_RISK_FRESHNESS_MAX_HOURS))
      ? Number(process.env.READINESS_RETENTION_RISK_FRESHNESS_MAX_HOURS)
      : retentionBudgets.retentionRiskFreshnessMaxHours;
    const structureRiskFreshnessMaxHours = Number.isFinite(Number(process.env.READINESS_STRUCTURE_RISK_FRESHNESS_MAX_HOURS))
      ? Number(process.env.READINESS_STRUCTURE_RISK_FRESHNESS_MAX_HOURS)
      : structureBudgets.structureRiskFreshnessMaxHours;
    const loadRiskGeneratedAtHours = parseGeneratedAtHours(loadRisk && loadRisk.generatedAt);
    const missingIndexGeneratedAtHours = parseGeneratedAtHours(missingIndexSurface && missingIndexSurface.generatedAt);
    const retentionRiskGeneratedAtHours = parseGeneratedAtHours(retentionRisk && retentionRisk.generatedAt);
    const structureRiskGeneratedAtHours = parseGeneratedAtHours(structureRisk && structureRisk.generatedAt);
    const snapshotStaleRatioThreshold = Number.isFinite(Number(process.env.READ_PATH_SNAPSHOT_STALE_RATIO_MAX))
      ? Number(process.env.READ_PATH_SNAPSHOT_STALE_RATIO_MAX)
      : (Number.isFinite(budgets.snapshotStaleRatioMax) ? budgets.snapshotStaleRatioMax : 0.5);
    const fallbackSpikeThreshold = Number.isFinite(Number(process.env.READ_PATH_FALLBACK_SPIKE_MAX))
      ? Number(process.env.READ_PATH_FALLBACK_SPIKE_MAX)
      : (Number.isFinite(budgets.fallbackSpikeMax) ? budgets.fallbackSpikeMax : 200);

    const snapshotRefreshJobConfigured = isSnapshotRefreshJobConfigured();
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
      if (!Number.isFinite(loadRiskGeneratedAtHours)) {
        blockers.push({ code: 'load_risk_generated_at_invalid', message: 'load_risk.json generatedAt is missing or invalid' });
      } else if (Number.isFinite(loadRiskFreshnessMaxHours) && loadRiskGeneratedAtHours > loadRiskFreshnessMaxHours) {
        blockers.push({
          code: 'load_risk_generated_at_stale',
          message: 'load_risk.json is stale',
          value: loadRiskGeneratedAtHours,
          thresholdHours: loadRiskFreshnessMaxHours
        });
      }

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
    } else if (snapshotRefreshJobConfigured && staleRatio > snapshotStaleRatioThreshold) {
      blockers.push({
        code: 'snapshot_stale_ratio_high',
        message: 'snapshot stale ratio is above threshold',
        value: staleRatio,
        threshold: snapshotStaleRatioThreshold
      });
    }

    if (fallbackEventsCount > fallbackSpikeThreshold) {
      blockers.push({
        code: 'fallback_spike_detected',
        message: 'read-path fallback events exceed spike threshold',
        value: fallbackEventsCount,
        threshold: fallbackSpikeThreshold
      });
    }

    const missingIndexSurfaceCount = Number.isFinite(Number(missingIndexSurface && missingIndexSurface.surface_count))
      ? Number(missingIndexSurface.surface_count)
      : NaN;
    const missingIndexSurfacePointCount = Number.isFinite(Number(missingIndexSurface && missingIndexSurface.point_count))
      ? Number(missingIndexSurface.point_count)
      : NaN;

    if (!missingIndexSurface) {
      if (Number.isFinite(budgets.missingIndexSurfaceMax)) {
        blockers.push({
          code: 'missing_index_surface_unavailable',
          message: 'missing_index_surface.json is not available',
          budget: budgets.missingIndexSurfaceMax
        });
      }
    } else if (!Number.isFinite(missingIndexGeneratedAtHours)) {
      blockers.push({
        code: 'missing_index_surface_generated_at_invalid',
        message: 'missing_index_surface.json generatedAt is missing or invalid',
        budget: budgets.missingIndexSurfaceFreshnessMaxHours
      });
    } else if (Number.isFinite(missingIndexSurfaceFreshnessMaxHours) && missingIndexGeneratedAtHours > missingIndexSurfaceFreshnessMaxHours) {
      blockers.push({
        code: 'missing_index_surface_generated_at_stale',
        message: 'missing_index_surface.json is stale',
        value: missingIndexGeneratedAtHours,
        thresholdHours: budgets.missingIndexSurfaceFreshnessMaxHours
      });
    }

    if (Number.isFinite(budgets.missingIndexSurfaceMax)
      && !Number.isFinite(missingIndexSurfaceCount)) {
      blockers.push({
        code: 'missing_index_surface_invalid_data',
        message: 'missing_index_surface.json surface_count is missing or invalid',
        budget: budgets.missingIndexSurfaceMax
      });
    } else if (Number.isFinite(budgets.missingIndexSurfaceMax)
      && missingIndexSurfaceCount > budgets.missingIndexSurfaceMax) {
      blockers.push({
        code: 'missing_index_surface_over_budget',
        message: 'missing-index surface exceeds budget',
        value: missingIndexSurfaceCount,
        budget: budgets.missingIndexSurfaceMax
      });
    }

    const undefinedRetentionCount = Number.isFinite(Number(retentionRisk && retentionRisk.undefined_retention_count))
      ? Number(retentionRisk.undefined_retention_count)
      : NaN;
    const undefinedDeletableConditionalCount = Number.isFinite(Number(retentionRisk && retentionRisk.undefined_deletable_conditional_count))
      ? Number(retentionRisk.undefined_deletable_conditional_count)
      : NaN;
    const undefinedRecomputableCount = Number.isFinite(Number(retentionRisk && retentionRisk.undefined_recomputable_count))
      ? Number(retentionRisk.undefined_recomputable_count)
      : NaN;
    const legacyReposCount = Number.isFinite(Number(structureRisk && structureRisk.legacy_repos_count))
      ? Number(structureRisk.legacy_repos_count)
      : NaN;
    const mergeCandidatesCount = Number.isFinite(Number(structureRisk && structureRisk.merge_candidates_count))
      ? Number(structureRisk.merge_candidates_count)
      : NaN;
    const namingDriftScenarioCount = Number.isFinite(Number(structureRisk && structureRisk.naming_drift_scenario_count))
      ? Number(structureRisk.naming_drift_scenario_count)
      : NaN;
    const unresolvedDynamicDepCount = Number.isFinite(Number(structureRisk && structureRisk.unresolved_dynamic_dep_count))
      ? Number(structureRisk.unresolved_dynamic_dep_count)
      : NaN;
    const activeLegacyRepoImports = countActiveLegacyRepoImports(structureRisk, dependencyGraph);

    if (!retentionRisk) {
      blockers.push({
        code: 'retention_risk_missing',
        message: 'retention_risk.json is not available',
        budget: retentionBudgets
      });
    } else if (!Number.isFinite(retentionRiskGeneratedAtHours)) {
      blockers.push({
        code: 'retention_risk_generated_at_invalid',
        message: 'retention_risk.json generatedAt is missing or invalid',
        budget: retentionRiskFreshnessMaxHours
      });
    } else if (
      Number.isFinite(retentionRiskFreshnessMaxHours)
      && retentionRiskGeneratedAtHours > retentionRiskFreshnessMaxHours
    ) {
      blockers.push({
        code: 'retention_risk_generated_at_stale',
        message: 'retention_risk.json is stale',
        value: retentionRiskGeneratedAtHours,
        thresholdHours: retentionRiskFreshnessMaxHours
      });
    }

    if (Number.isFinite(retentionBudgets.undefinedRetentionMax)
      && !Number.isFinite(undefinedRetentionCount)) {
      blockers.push({
        code: 'retention_risk_invalid_data',
        message: 'retention_risk undefined_retention_count is missing or invalid',
        budget: retentionBudgets.undefinedRetentionMax
      });
    } else if (
      Number.isFinite(retentionBudgets.undefinedRetentionMax)
      && undefinedRetentionCount > retentionBudgets.undefinedRetentionMax
    ) {
      blockers.push({
        code: 'retention_risk_undefined_over_budget',
        message: 'retention undefined count exceeds budget',
        value: undefinedRetentionCount,
        budget: retentionBudgets.undefinedRetentionMax
      });
    }

    if (Number.isFinite(retentionBudgets.undefinedDeletableConditionalMax)
      && !Number.isFinite(undefinedDeletableConditionalCount)) {
      blockers.push({
        code: 'retention_risk_conditional_invalid_data',
        message: 'retention_risk undefined_deletable_conditional_count is missing or invalid',
        budget: retentionBudgets.undefinedDeletableConditionalMax
      });
    } else if (
      Number.isFinite(retentionBudgets.undefinedDeletableConditionalMax)
      && undefinedDeletableConditionalCount > retentionBudgets.undefinedDeletableConditionalMax
    ) {
      blockers.push({
        code: 'retention_risk_conditional_over_budget',
        message: 'retention undefined conditional-deletable count exceeds budget',
        value: undefinedDeletableConditionalCount,
        budget: retentionBudgets.undefinedDeletableConditionalMax
      });
    }

    if (Number.isFinite(retentionBudgets.undefinedRecomputableMax)
      && !Number.isFinite(undefinedRecomputableCount)) {
      blockers.push({
        code: 'retention_risk_recomputable_invalid_data',
        message: 'retention_risk undefined_recomputable_count is missing or invalid',
        budget: retentionBudgets.undefinedRecomputableMax
      });
    } else if (
      Number.isFinite(retentionBudgets.undefinedRecomputableMax)
      && undefinedRecomputableCount > retentionBudgets.undefinedRecomputableMax
    ) {
      blockers.push({
        code: 'retention_risk_recomputable_over_budget',
        message: 'retention undefined recomputable count exceeds budget',
        value: undefinedRecomputableCount,
        budget: retentionBudgets.undefinedRecomputableMax
      });
    }

    if (!structureRisk) {
      blockers.push({
        code: 'structure_risk_missing',
        message: 'structure_risk.json is not available',
        budget: structureBudgets
      });
    } else if (!Number.isFinite(structureRiskGeneratedAtHours)) {
      blockers.push({
        code: 'structure_risk_generated_at_invalid',
        message: 'structure_risk.json generatedAt is missing or invalid',
        budget: structureRiskFreshnessMaxHours
      });
    } else if (
      Number.isFinite(structureRiskFreshnessMaxHours)
      && structureRiskGeneratedAtHours > structureRiskFreshnessMaxHours
    ) {
      blockers.push({
        code: 'structure_risk_generated_at_stale',
        message: 'structure_risk.json is stale',
        value: structureRiskGeneratedAtHours,
        thresholdHours: structureRiskFreshnessMaxHours
      });
    }

    if (Number.isFinite(structureBudgets.legacyReposMax)
      && !Number.isFinite(legacyReposCount)) {
      blockers.push({
        code: 'structure_risk_invalid_data',
        message: 'structure_risk legacy_repos_count is missing or invalid',
        budget: structureBudgets.legacyReposMax
      });
    } else if (
      Number.isFinite(structureBudgets.legacyReposMax)
      && legacyReposCount > structureBudgets.legacyReposMax
    ) {
      blockers.push({
        code: 'structure_risk_legacy_over_budget',
        message: 'structure legacy repos count exceeds budget',
        value: legacyReposCount,
        budget: structureBudgets.legacyReposMax
      });
    }

    if (Number.isFinite(structureBudgets.mergeCandidatesMax)
      && !Number.isFinite(mergeCandidatesCount)) {
      blockers.push({
        code: 'structure_risk_merge_candidates_invalid_data',
        message: 'structure_risk merge_candidates_count is missing or invalid',
        budget: structureBudgets.mergeCandidatesMax
      });
    } else if (
      Number.isFinite(structureBudgets.mergeCandidatesMax)
      && mergeCandidatesCount > structureBudgets.mergeCandidatesMax
    ) {
      blockers.push({
        code: 'structure_risk_merge_candidates_over_budget',
        message: 'structure merge candidates count exceeds budget',
        value: mergeCandidatesCount,
        budget: structureBudgets.mergeCandidatesMax
      });
    }

    if (Number.isFinite(structureBudgets.namingDriftScenarioMax)
      && !Number.isFinite(namingDriftScenarioCount)) {
      blockers.push({
        code: 'structure_risk_naming_drift_invalid_data',
        message: 'structure_risk naming_drift_scenario_count is missing or invalid',
        budget: structureBudgets.namingDriftScenarioMax
      });
    } else if (
      Number.isFinite(structureBudgets.namingDriftScenarioMax)
      && namingDriftScenarioCount > structureBudgets.namingDriftScenarioMax
    ) {
      blockers.push({
        code: 'structure_risk_naming_drift_over_budget',
        message: 'structure naming drift legacy field count exceeds budget',
        value: namingDriftScenarioCount,
        budget: structureBudgets.namingDriftScenarioMax
      });
    }

    if (Number.isFinite(structureBudgets.unresolvedDynamicDepMax)
      && !Number.isFinite(unresolvedDynamicDepCount)) {
      blockers.push({
        code: 'structure_risk_unresolved_dynamic_dep_invalid_data',
        message: 'structure_risk unresolved_dynamic_dep_count is missing or invalid',
        budget: structureBudgets.unresolvedDynamicDepMax
      });
    } else if (
      Number.isFinite(structureBudgets.unresolvedDynamicDepMax)
      && unresolvedDynamicDepCount > structureBudgets.unresolvedDynamicDepMax
    ) {
      blockers.push({
        code: 'structure_risk_unresolved_dynamic_dep_over_budget',
        message: 'structure unresolved dynamic dependency count exceeds budget',
        value: unresolvedDynamicDepCount,
        budget: structureBudgets.unresolvedDynamicDepMax
      });
    }

    if (
      Number.isFinite(structureBudgets.activeLegacyRepoImportsMax)
      && activeLegacyRepoImports > structureBudgets.activeLegacyRepoImportsMax
    ) {
      blockers.push({
        code: 'structure_risk_active_legacy_imports_over_budget',
        message: 'active legacy repo imports exceed budget',
        value: activeLegacyRepoImports,
        budget: structureBudgets.activeLegacyRepoImportsMax
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
          fallbackEventsCount,
          retentionUndefinedCount: Number.isFinite(undefinedRetentionCount) ? undefinedRetentionCount : null,
          retentionConditionalUndefinedCount: Number.isFinite(undefinedDeletableConditionalCount)
            ? undefinedDeletableConditionalCount
            : null,
          retentionRecomputableUndefinedCount: Number.isFinite(undefinedRecomputableCount)
            ? undefinedRecomputableCount
            : null,
          structureLegacyReposCount: Number.isFinite(legacyReposCount) ? legacyReposCount : null,
          structureMergeCandidatesCount: Number.isFinite(mergeCandidatesCount) ? mergeCandidatesCount : null,
          structureNamingDriftScenarioCount: Number.isFinite(namingDriftScenarioCount)
            ? namingDriftScenarioCount
            : null,
          structureUnresolvedDynamicDepCount: Number.isFinite(unresolvedDynamicDepCount)
            ? unresolvedDynamicDepCount
            : null,
          activeLegacyRepoImports
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
          generatedAtHours: Number.isFinite(loadRiskGeneratedAtHours) ? loadRiskGeneratedAtHours : null,
          freshnessHoursMax: loadRiskFreshnessMaxHours,
          budget: budgets
        },
        snapshotHealth: {
          ok: snapshotCount > 0 && (!snapshotRefreshJobConfigured || staleRatio <= snapshotStaleRatioThreshold),
          snapshotCount,
          staleCount,
          staleRatio,
          staleRatioThreshold: snapshotStaleRatioThreshold,
          staleAfterMinutes,
          snapshotRefreshJobConfigured
        },
        fallbackSpikes: {
          ok: fallbackEventsCount <= fallbackSpikeThreshold,
          count: fallbackEventsCount,
          threshold: fallbackSpikeThreshold,
          windowHours
        },
        missingIndexSurface: {
          ok: blockers.every((item) => !String(item.code).startsWith('missing_index_surface_')),
          surfaceCount: Number.isFinite(missingIndexSurfaceCount) ? missingIndexSurfaceCount : null,
          pointCount: Number.isFinite(missingIndexSurfacePointCount) ? missingIndexSurfacePointCount : null,
          generatedAtHours: Number.isFinite(missingIndexGeneratedAtHours) ? missingIndexGeneratedAtHours : null,
          freshnessHoursMax: missingIndexSurfaceFreshnessMaxHours,
          budget: budgets.missingIndexSurfaceMax
        },
        retentionRisk: {
          ok: blockers.every((item) => !String(item.code).startsWith('retention_risk_')),
          value: retentionRisk || null,
          generatedAtHours: Number.isFinite(retentionRiskGeneratedAtHours) ? retentionRiskGeneratedAtHours : null,
          freshnessHoursMax: retentionRiskFreshnessMaxHours,
          undefinedRetentionCount: Number.isFinite(undefinedRetentionCount) ? undefinedRetentionCount : null,
          undefinedDeletableConditionalCount: Number.isFinite(undefinedDeletableConditionalCount)
            ? undefinedDeletableConditionalCount
            : null,
          undefinedRecomputableCount: Number.isFinite(undefinedRecomputableCount)
            ? undefinedRecomputableCount
            : null,
          budget: retentionBudgets
        },
        structureRisk: {
          ok: blockers.every((item) => !String(item.code).startsWith('structure_risk_')),
          value: structureRisk || null,
          generatedAtHours: Number.isFinite(structureRiskGeneratedAtHours) ? structureRiskGeneratedAtHours : null,
          freshnessHoursMax: structureRiskFreshnessMaxHours,
          legacyReposCount: Number.isFinite(legacyReposCount) ? legacyReposCount : null,
          mergeCandidatesCount: Number.isFinite(mergeCandidatesCount) ? mergeCandidatesCount : null,
          namingDriftScenarioCount: Number.isFinite(namingDriftScenarioCount) ? namingDriftScenarioCount : null,
          unresolvedDynamicDepCount: Number.isFinite(unresolvedDynamicDepCount) ? unresolvedDynamicDepCount : null,
          activeLegacyRepoImports,
          budget: structureBudgets
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
