'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const analyticsReadRepo = require('../../repos/firestore/analyticsReadRepo');
const userContextSnapshotsRepo = require('../../repos/firestore/userContextSnapshotsRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');

const MAX_EVENTS = 200;
const MAX_TASKS = 5;
const MAX_RISKS = 3;
const MAX_PRIORITIES = 3;
const ALLOWED_PHASES = new Set(['pre', 'arrival', 'settled', 'extend', 'return']);

const STEP_TO_PHASE = Object.freeze({
  '3mo': 'pre',
  '1mo': 'pre',
  week: 'pre',
  after1w: 'arrival'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizePhase(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return '';
  return ALLOWED_PHASES.has(normalized) ? normalized : '';
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value > 1000000000000 ? value : value * 1000).toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    if (parsed instanceof Date && Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function normalizePriority(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'safety' || normalized === 'speed' || normalized === 'cost') return normalized;
  return '';
}

function parsePriorities(user) {
  const fromArray = Array.isArray(user && user.priorities)
    ? user.priorities.map((item) => normalizePriority(item)).filter(Boolean)
    : [];
  const unique = [];
  fromArray.forEach((item) => {
    if (!unique.includes(item)) unique.push(item);
  });
  return unique.slice(0, MAX_PRIORITIES);
}

function resolvePhase(user, events) {
  const latestPhaseEvent = (Array.isArray(events) ? events : []).find((row) => {
    const event = row && row.data ? row.data : row || {};
    const type = normalizeText(event && event.type).toLowerCase();
    return type === 'user_phase_changed';
  });
  const eventPayload = latestPhaseEvent && latestPhaseEvent.data ? latestPhaseEvent.data : {};
  const fromEvent = normalizePhase(eventPayload.toPhase || eventPayload.phase);
  if (fromEvent) return fromEvent;

  const fromUser = normalizePhase(user && (user.phase || user.journeyPhase));
  if (fromUser) return fromUser;

  const stepKey = normalizeText(user && user.stepKey);
  if (Object.prototype.hasOwnProperty.call(STEP_TO_PHASE, stepKey)) {
    return STEP_TO_PHASE[stepKey];
  }

  return 'pre';
}

function resolveLocation(user) {
  const city = normalizeText(user && (user.city || user.cityLabel || user.targetCity));
  const state = normalizeText(user && (user.state || user.region || user.regionKey));
  return {
    city: city || null,
    state: state || null
  };
}

function resolveFamily(user) {
  const family = user && user.family && typeof user.family === 'object' ? user.family : {};
  const spouse = family.spouse === true;
  const kidsAges = Array.isArray(family.kidsAges)
    ? family.kidsAges.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item >= 0 && item <= 30)
    : [];
  return {
    spouse,
    kidsAges
  };
}

function parseActionKey(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, '_').slice(0, 80);
}

function buildTasksFromEvents(events) {
  const out = [];
  const seen = new Set();
  (events || []).forEach((row) => {
    const event = row && row.data ? row.data : row || {};
    const type = normalizeText(event.type).toLowerCase();
    if (type !== 'next_action_shown' && type !== 'next_action_completed') return;
    const items = Array.isArray(event.nextActions)
      ? event.nextActions
      : (Array.isArray(event.actions) ? event.actions : []);
    items.forEach((item) => {
      const key = parseActionKey(item && (item.key || item.action || item.title || item));
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({
        key,
        due: toIso(item && item.due),
        status: type === 'next_action_completed' ? 'done' : normalizeText(item && item.status).toLowerCase() || 'open'
      });
    });
  });
  return out;
}

function buildRiskFlagsFromEvents(events) {
  const out = [];
  const seen = new Set();
  (events || []).forEach((row) => {
    const event = row && row.data ? row.data : row || {};
    const direct = normalizeText(event.riskFlag || event.risk);
    if (direct) {
      const key = direct.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
    const arr = Array.isArray(event.riskFlags) ? event.riskFlags : [];
    arr.forEach((item) => {
      const key = normalizeText(item).toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(key);
    });
  });
  return out;
}

function resolveLastSummary(events) {
  for (const row of events || []) {
    const event = row && row.data ? row.data : row || {};
    const summary = normalizeText(event.summary || event.assistantSummary || event.situation);
    if (summary) return summary;
  }
  return '';
}

function parseTodoRiskFlags(todoItems) {
  const out = [];
  const seen = new Set();
  (todoItems || []).forEach((item) => {
    if (!item || item.status !== 'open') return;
    if (item.graphStatus === 'locked') {
      const key = `dependency_locked:${item.todoKey || 'task'}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
    if (String(item.riskLevel || '').toLowerCase() === 'high') {
      const key = `high_risk:${item.todoKey || 'task'}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  });
  return out;
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return null;
}

function resolveTodoRiskScore(item) {
  const payload = item && typeof item === 'object' ? item : {};
  const explicit = Number(payload.riskScore);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  let score = 0;
  if (payload.graphStatus === 'locked') score += 100;
  const dueMs = toMillis(payload.dueAt);
  if (Number.isFinite(dueMs)) {
    const nowMs = Date.now();
    if (dueMs <= nowMs) score += 80;
    else if (dueMs <= nowMs + (3 * 24 * 60 * 60 * 1000)) score += 50;
    else if (dueMs <= nowMs + (7 * 24 * 60 * 60 * 1000)) score += 20;
  }
  const priority = Number(payload.priority);
  if (Number.isFinite(priority)) score += Math.max(1, Math.min(5, Math.floor(priority))) * 10;
  const riskLevel = normalizeText(payload.riskLevel).toLowerCase();
  if (riskLevel === 'high') score += 25;
  if (riskLevel === 'medium') score += 10;
  return score;
}

function buildTopOpenTasksFromTodos(todoItems) {
  return (Array.isArray(todoItems) ? todoItems : [])
    .filter((item) => item && item.status === 'open')
    .map((item) => ({
      key: parseActionKey(item.todoKey || item.key || item.title),
      due: toIso(item.dueAt || item.dueDate),
      status: item.graphStatus === 'locked'
        ? 'locked'
        : (item.progressState === 'in_progress' ? 'in_progress' : 'open'),
      title: normalizeText(item.title || item.todoKey),
      riskScore: resolveTodoRiskScore(item)
    }))
    .filter((item) => item.key)
    .sort((a, b) => {
      if (a.riskScore !== b.riskScore) return b.riskScore - a.riskScore;
      const dueA = toMillis(a.due);
      const dueB = toMillis(b.due);
      if (Number.isFinite(dueA) && Number.isFinite(dueB) && dueA !== dueB) return dueA - dueB;
      return a.key.localeCompare(b.key, 'ja');
    })
    .slice(0, MAX_TASKS)
    .map((item) => ({
      key: item.key,
      due: item.due,
      status: item.status
    }));
}

function buildShortSummary(snapshot) {
  const payload = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const phase = normalizeText(payload.phase) || 'pre';
  const city = payload.location && payload.location.city ? String(payload.location.city) : 'unknown';
  const openCount = Array.isArray(payload.topOpenTasks) ? payload.topOpenTasks.length : 0;
  const riskCount = Array.isArray(payload.riskFlags) ? payload.riskFlags.length : 0;
  return `phase=${phase}, city=${city}, openTasks=${openCount}, risks=${riskCount}`;
}

function countDropped(rawCount, keptCount) {
  const raw = Number(rawCount);
  const kept = Number(keptCount);
  if (!Number.isFinite(raw) || !Number.isFinite(kept)) return 0;
  if (raw <= kept) return 0;
  return raw - kept;
}

async function appendSnapshotAudit(action, payload) {
  try {
    await appendAuditLog({
      actor: payload.actor || 'snapshot_job',
      action,
      entityType: 'user_context_snapshot',
      entityId: payload.lineUserId || 'unknown',
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: payload.payloadSummary || {}
    });
  } catch (_err) {
    // best effort only
  }
}

async function buildUserContextSnapshot(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  if (!lineUserId) throw new Error('lineUserId required');

  const users = resolvedDeps.usersRepo || usersRepo;
  const readRepo = resolvedDeps.analyticsReadRepo || analyticsReadRepo;
  const snapshots = resolvedDeps.userContextSnapshotsRepo || userContextSnapshotsRepo;
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;

  const user = await users.getUser(lineUserId);
  if (!user) {
    return {
      ok: false,
      lineUserId,
      reason: 'user_not_found'
    };
  }

  let eventsFailed = false;
  const events = await readRepo.listEventsByLineUserIdAndCreatedAtRange({
    lineUserId,
    limit: MAX_EVENTS
  }).catch(() => {
    eventsFailed = true;
    return [];
  });
  let todoQueryFailed = false;
  const todoItems = await todoRepo.listJourneyTodoItemsByLineUserId({
    lineUserId,
    limit: 200
  }).catch(() => {
    todoQueryFailed = true;
    return [];
  });

  const prioritiesRaw = parsePriorities(user);
  const tasksRaw = buildTasksFromEvents(events);
  const risksRaw = buildRiskFlagsFromEvents(events);
  const todoBasedTasks = buildTopOpenTasksFromTodos(todoItems);
  const todoRiskFlagsRaw = parseTodoRiskFlags(todoItems);
  const mergedRiskFlags = risksRaw.concat(todoRiskFlagsRaw).filter(Boolean);
  const riskFlagsUnique = [];
  mergedRiskFlags.forEach((item) => {
    if (!riskFlagsUnique.includes(item)) riskFlagsUnique.push(item);
  });

  const snapshot = {
    lineUserId,
    phase: resolvePhase(user, events),
    location: resolveLocation(user),
    family: resolveFamily(user),
    priorities: prioritiesRaw.slice(0, MAX_PRIORITIES),
    openTasksTop5: tasksRaw.slice(0, MAX_TASKS),
    riskFlagsTop3: risksRaw.slice(0, MAX_RISKS),
    lastSummary: resolveLastSummary(events),
    topOpenTasks: todoBasedTasks.slice(0, MAX_TASKS),
    riskFlags: riskFlagsUnique.slice(0, MAX_TASKS),
    shortSummary: '',
    sourceUpdatedAt: toIso(user.updatedAt || user.createdAt),
    snapshotVersion: 1,
    updatedAt: payload.updatedAt || new Date().toISOString()
  };
  snapshot.shortSummary = buildShortSummary(snapshot);

  const droppedSummary = {
    priorities: countDropped(prioritiesRaw.length, snapshot.priorities.length),
    openTasksTop5: countDropped(tasksRaw.length, snapshot.openTasksTop5.length),
    riskFlagsTop3: countDropped(risksRaw.length, snapshot.riskFlagsTop3.length),
    topOpenTasks: countDropped(todoBasedTasks.length, snapshot.topOpenTasks.length),
    riskFlags: countDropped(riskFlagsUnique.length, snapshot.riskFlags.length)
  };

  if (payload.write !== false) {
    await snapshots.upsertUserContextSnapshot(lineUserId, snapshot);
  }

  await appendSnapshotAudit('snapshot_updated', {
    actor: payload.actor || 'snapshot_job',
    lineUserId,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: {
      lineUserId,
      phase: snapshot.phase,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
      snapshotVersion: snapshot.snapshotVersion,
      updatedAt: snapshot.updatedAt
    }
  });

  if (droppedSummary.priorities > 0 || droppedSummary.openTasksTop5 > 0 || droppedSummary.riskFlagsTop3 > 0) {
    await appendSnapshotAudit('snapshot_dropped_keys', {
      actor: payload.actor || 'snapshot_job',
      lineUserId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: {
        lineUserId,
        droppedSummary
      }
    });
  }

  if (droppedSummary.topOpenTasks > 0 || droppedSummary.riskFlags > 0 || payload.recompressed === true) {
    await appendSnapshotAudit('snapshot_trimmed', {
      actor: payload.actor || 'snapshot_job',
      lineUserId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: {
        lineUserId,
        droppedSummary
      }
    });
  }

  if (payload.recompressed === true) {
    await appendSnapshotAudit('snapshot_recompressed', {
      actor: payload.actor || 'snapshot_job',
      lineUserId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: {
        lineUserId,
        updatedAt: snapshot.updatedAt
      }
    });
  }

  if (eventsFailed || todoQueryFailed) {
    await appendSnapshotAudit('snapshot_build_fallback', {
      actor: payload.actor || 'snapshot_job',
      lineUserId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: {
        lineUserId,
        eventsFailed,
        todoQueryFailed
      }
    });
  }

  return {
    ok: true,
    lineUserId,
    snapshot,
    droppedSummary
  };
}

module.exports = {
  buildUserContextSnapshot
};
