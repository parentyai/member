'use strict';

const userContextSnapshotsRepo = require('../../repos/firestore/userContextSnapshotsRepo');
const { getTaskMemory } = require('../../v1/memory_fabric/taskMemoryRepo');
const { getSessionMemory } = require('../../v1/memory_fabric/sessionMemoryRepo');
const { getProfileMemory } = require('../../v1/memory_fabric/profileMemoryRepo');
const { getComplianceMemory } = require('../../v1/memory_fabric/complianceMemoryRepo');

const ALLOWED_PHASES = new Set(['pre', 'arrival', 'settled', 'extend', 'return']);
const ALLOWED_PRIORITIES = new Set(['safety', 'speed', 'cost']);

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    if (parsed instanceof Date && Number.isFinite(parsed.getTime())) return parsed.getTime();
  }
  return null;
}

function resolveMaxAgeHours(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return 24 * 30;
  return Math.min(Math.floor(raw), 24 * 365);
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeStringList(value, limit) {
  const rows = Array.isArray(value) ? value : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 5;
  const out = [];
  rows.forEach((item) => {
    if (out.length >= max) return;
    const normalized = normalizeText(item);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function normalizePhase(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return 'pre';
  return ALLOWED_PHASES.has(normalized) ? normalized : 'pre';
}

function normalizePriorities(primary, fallback) {
  const combined = normalizeStringList([].concat(primary || [], fallback || []), 6);
  return combined
    .map((item) => item.toLowerCase())
    .filter((item) => ALLOWED_PRIORITIES.has(item))
    .slice(0, 3);
}

function normalizeTopOpenTasks(taskKeys, unresolvedItems) {
  const keys = normalizeStringList([].concat(taskKeys || [], unresolvedItems || []), 8).slice(0, 5);
  const unresolved = new Set(normalizeStringList(unresolvedItems, 8));
  return keys.map((key) => ({
    key,
    due: null,
    status: unresolved.has(key) ? 'open' : 'in_progress'
  }));
}

function resolveLocation(recurringDestinations) {
  const values = normalizeStringList(recurringDestinations, 4);
  return {
    city: values[0] || null,
    state: values[1] || null
  };
}

function resolveFamily(familyStructure) {
  const normalized = normalizeText(familyStructure).toLowerCase();
  return {
    spouse: normalized.includes('spouse'),
    kidsAges: []
  };
}

function toIsoFromMs(ms) {
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function resolveMemoryLaneTimestamp(laneRecord) {
  if (!laneRecord || typeof laneRecord !== 'object') return null;
  const row = laneRecord.data && typeof laneRecord.data === 'object' ? laneRecord.data : {};
  const fromEffectiveDates = row.effective_dates && typeof row.effective_dates === 'object'
    ? toMillis(row.effective_dates.snapshotUpdatedAt || row.effective_dates.sourceUpdatedAt)
    : null;
  return toMillis(laneRecord.updatedAt) || fromEffectiveDates;
}

function buildSnapshotFromMemoryLanes(lineUserId, laneRows) {
  const rows = laneRows && typeof laneRows === 'object' ? laneRows : {};
  const taskData = rows.task && rows.task.data && typeof rows.task.data === 'object' ? rows.task.data : {};
  const sessionData = rows.session && rows.session.data && typeof rows.session.data === 'object' ? rows.session.data : {};
  const profileData = rows.profile && rows.profile.data && typeof rows.profile.data === 'object' ? rows.profile.data : {};
  const complianceData = rows.compliance && rows.compliance.data && typeof rows.compliance.data === 'object' ? rows.compliance.data : {};

  const taskKeys = normalizeStringList(taskData.current_selected_options, 5);
  const unresolvedItems = normalizeStringList(sessionData.unresolved_items, 5);
  const shownOptions = normalizeStringList(sessionData.shown_options, 5);
  const topOpenTasks = normalizeTopOpenTasks(taskKeys.length ? taskKeys : shownOptions, unresolvedItems);
  const riskFlags = normalizeStringList(
    [].concat(taskData.current_constraints || [], profileData.recurring_constraints || []),
    5
  );
  const priorities = normalizePriorities(sessionData.user_decisions, profileData.recurring_document_patterns);
  const sourceUpdatedAt = complianceData.effective_dates && typeof complianceData.effective_dates === 'object'
    ? toIsoFromMs(toMillis(complianceData.effective_dates.sourceUpdatedAt))
    : null;
  const laneUpdatedAtMs = [rows.task, rows.session, rows.profile, rows.compliance]
    .map((row) => resolveMemoryLaneTimestamp(row))
    .filter((value) => Number.isFinite(value));
  const updatedAtMs = laneUpdatedAtMs.length ? Math.max(...laneUpdatedAtMs) : toMillis(sourceUpdatedAt);

  const snapshot = {
    lineUserId,
    phase: normalizePhase(complianceData.journey_phase || sessionData.journey_phase),
    location: resolveLocation(profileData.recurring_destinations),
    family: resolveFamily(profileData.family_structure),
    priorities,
    openTasksTop5: topOpenTasks,
    riskFlagsTop3: riskFlags.slice(0, 3),
    lastSummary: normalizeText(taskData.current_goal || ''),
    topOpenTasks,
    riskFlags,
    shortSummary: normalizeText(taskData.current_goal || ''),
    sourceUpdatedAt,
    snapshotVersion: 2,
    updatedAt: toIsoFromMs(updatedAtMs) || sourceUpdatedAt || null
  };

  if (!snapshot.shortSummary) {
    const openCount = topOpenTasks.length;
    const riskCount = riskFlags.length;
    snapshot.shortSummary = `phase=${snapshot.phase}, openTasks=${openCount}, risks=${riskCount}`;
  }
  return snapshot;
}

function hasMemoryLaneData(lanes) {
  return Boolean(
    lanes
    && (lanes.task || lanes.session || lanes.profile || lanes.compliance)
  );
}

async function readSnapshotFromMemoryFabric(lineUserId, deps) {
  const repositories = deps && typeof deps === 'object' ? deps : {};
  const taskRepo = repositories.taskMemoryRepo && typeof repositories.taskMemoryRepo.getTaskMemory === 'function'
    ? repositories.taskMemoryRepo
    : { getTaskMemory };
  const sessionRepo = repositories.sessionMemoryRepo && typeof repositories.sessionMemoryRepo.getSessionMemory === 'function'
    ? repositories.sessionMemoryRepo
    : { getSessionMemory };
  const profileRepo = repositories.profileMemoryRepo && typeof repositories.profileMemoryRepo.getProfileMemory === 'function'
    ? repositories.profileMemoryRepo
    : { getProfileMemory };
  const complianceRepo = repositories.complianceMemoryRepo && typeof repositories.complianceMemoryRepo.getComplianceMemory === 'function'
    ? repositories.complianceMemoryRepo
    : { getComplianceMemory };

  const [task, session, profile, compliance] = await Promise.all([
    taskRepo.getTaskMemory(lineUserId).catch(() => null),
    sessionRepo.getSessionMemory(lineUserId).catch(() => null),
    profileRepo.getProfileMemory(lineUserId).catch(() => null),
    complianceRepo.getComplianceMemory(lineUserId).catch(() => null)
  ]);
  const lanes = { task, session, profile, compliance };
  if (!hasMemoryLaneData(lanes)) return null;
  const snapshot = buildSnapshotFromMemoryLanes(lineUserId, lanes);
  return {
    snapshot,
    laneAvailability: {
      task: Boolean(task),
      session: Boolean(session),
      profile: Boolean(profile),
      compliance: Boolean(compliance)
    }
  };
}

async function getUserContextSnapshot(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
  if (!lineUserId) {
    return {
      ok: false,
      reason: 'lineUserId_required',
      lineUserId: ''
    };
  }

  const memoryResult = await readSnapshotFromMemoryFabric(lineUserId, deps).catch(() => null);
  if (memoryResult && memoryResult.snapshot) {
    const updatedAtMs = toMillis(memoryResult.snapshot.updatedAt);
    const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();
    const ageHours = updatedAtMs && Number.isFinite(updatedAtMs)
      ? Math.max(0, Math.floor((nowMs - updatedAtMs) / (60 * 60 * 1000)))
      : null;
    const maxAgeHours = resolveMaxAgeHours(payload.maxAgeHours);
    return {
      ok: true,
      lineUserId,
      snapshot: memoryResult.snapshot,
      ageHours,
      stale: Number.isFinite(ageHours) ? ageHours > maxAgeHours : true,
      maxAgeHours,
      readPath: 'memory_fabric',
      memoryLaneAvailability: memoryResult.laneAvailability
    };
  }

  const repo = deps && deps.userContextSnapshotsRepo
    ? deps.userContextSnapshotsRepo
    : userContextSnapshotsRepo;
  const snapshot = await repo.getUserContextSnapshot(lineUserId);
  if (!snapshot) {
    return {
      ok: false,
      reason: 'snapshot_not_found',
      lineUserId,
      readPath: 'legacy_snapshot'
    };
  }

  const updatedAtMs = toMillis(snapshot.updatedAt);
  const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();
  const ageHours = updatedAtMs && Number.isFinite(updatedAtMs)
    ? Math.max(0, Math.floor((nowMs - updatedAtMs) / (60 * 60 * 1000)))
    : null;
  const maxAgeHours = resolveMaxAgeHours(payload.maxAgeHours);

  return {
    ok: true,
    lineUserId,
    snapshot,
    ageHours,
    stale: Number.isFinite(ageHours) ? ageHours > maxAgeHours : true,
    maxAgeHours,
    readPath: 'legacy_snapshot'
  };
}

module.exports = {
  getUserContextSnapshot
};
