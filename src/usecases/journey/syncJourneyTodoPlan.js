'use strict';

const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const journeyPolicyRepo = require('../../repos/firestore/journeyPolicyRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const journeyTodoStatsRepo = require('../../repos/firestore/journeyTodoStatsRepo');
const { recomputeJourneyTaskGraph } = require('./recomputeJourneyTaskGraph');

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function shiftIsoDays(isoDate, deltaDays) {
  const baseMs = Date.parse(`${isoDate}T09:00:00.000Z`);
  if (!Number.isFinite(baseMs)) return null;
  return new Date(baseMs + (deltaDays * DAY_MS)).toISOString();
}

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

function buildBaseTodoTemplates() {
  return [
    {
      todoKey: 'visa_documents',
      title: '必要書類（ビザ/在留関連）の最終確認',
      anchor: 'departure',
      offsetDays: -21,
      dependsOn: [],
      priority: 5,
      riskLevel: 'high'
    },
    {
      todoKey: 'housing_setup',
      title: '住居・ライフライン準備の確定',
      anchor: 'departure',
      offsetDays: -14,
      dependsOn: ['visa_documents'],
      priority: 4,
      riskLevel: 'high'
    },
    {
      todoKey: 'departure_final_check',
      title: '出発前最終チェック',
      anchor: 'departure',
      offsetDays: -7,
      dependsOn: ['visa_documents', 'housing_setup'],
      priority: 5,
      riskLevel: 'high'
    },
    {
      todoKey: 'arrival_registration',
      title: '着任後の登録手続き',
      anchor: 'assignment',
      offsetDays: 3,
      dependsOn: ['departure_final_check'],
      priority: 3,
      riskLevel: 'medium'
    }
  ];
}

function buildHouseholdTodoTemplates(householdType) {
  if (householdType === 'single') return [];
  return [
    {
      todoKey: 'family_support_plan',
      title: '帯同家族向けの生活準備確認',
      anchor: 'departure',
      offsetDays: -10,
      dependsOn: ['housing_setup'],
      priority: 4,
      riskLevel: 'medium'
    }
  ];
}

function resolveStage(schedule) {
  const payload = schedule && typeof schedule === 'object' ? schedule : {};
  if (payload.stage && typeof payload.stage === 'string' && payload.stage.trim()) return payload.stage.trim();
  const departureDate = toIsoDate(payload.departureDate);
  const assignmentDate = toIsoDate(payload.assignmentDate);
  const nowDate = new Date().toISOString().slice(0, 10);
  if (departureDate && nowDate < departureDate) return 'pre_departure';
  if (assignmentDate && nowDate >= assignmentDate) return 'arrived';
  if (departureDate && nowDate >= departureDate) return 'departure_ready';
  return 'unspecified';
}

function computeNextReminderAt(dueAt, reminderOffsetsDays, remindedOffsetsDays, nowIso) {
  const dueMs = Date.parse(dueAt || '');
  if (!Number.isFinite(dueMs)) return null;
  const nowMs = Date.parse(nowIso || new Date().toISOString());
  if (!Number.isFinite(nowMs)) return null;
  const offsets = Array.isArray(reminderOffsetsDays) ? reminderOffsetsDays : [7, 3, 1];
  const reminded = new Set(Array.isArray(remindedOffsetsDays) ? remindedOffsetsDays.map((value) => Number(value)) : []);
  const candidates = offsets
    .map((offset) => Number(offset))
    .filter((offset) => Number.isInteger(offset) && offset >= 0 && !reminded.has(offset))
    .map((offset) => ({
      offset,
      remindMs: dueMs - (offset * DAY_MS)
    }))
    .filter((item) => item.remindMs >= nowMs)
    .sort((a, b) => a.remindMs - b.remindMs);
  if (!candidates.length) return null;
  return new Date(candidates[0].remindMs).toISOString();
}

function resolveTemplateDueDate(template, schedule) {
  const departureDate = toIsoDate(schedule && schedule.departureDate);
  const assignmentDate = toIsoDate(schedule && schedule.assignmentDate);
  const anchorDate = template.anchor === 'assignment' ? assignmentDate : departureDate;
  if (!anchorDate) return null;
  const dueAt = shiftIsoDays(anchorDate, template.offsetDays);
  if (!dueAt) return null;
  return {
    dueDate: dueAt.slice(0, 10),
    dueAt
  };
}

async function refreshJourneyTodoStats(lineUserId, deps, nowIso) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;
  const statsRepo = resolvedDeps.journeyTodoStatsRepo || journeyTodoStatsRepo;
  const now = nowIso || new Date().toISOString();
  const nowMs = Date.parse(now);
  const list = await todoRepo.listJourneyTodoItemsByLineUserId({ lineUserId, limit: 500 });

  let openCount = 0;
  let totalCount = 0;
  let completedCount = 0;
  let lockedCount = 0;
  let actionableCount = 0;
  let overdueCount = 0;
  let dueIn7DaysCount = 0;
  let nextDueAt = null;
  let lastReminderAt = null;

  list.forEach((item) => {
    totalCount += 1;
    const dueMs = Date.parse(item && item.dueAt ? item.dueAt : '');
    const reminderMs = Date.parse(item && item.lastReminderAt ? item.lastReminderAt : '');
    if (Number.isFinite(reminderMs) && (!lastReminderAt || reminderMs > Date.parse(lastReminderAt))) {
      lastReminderAt = new Date(reminderMs).toISOString();
    }
    if (!item || (item.status !== 'open' && item.status !== 'completed' && item.status !== 'skipped')) return;
    if (item.status === 'completed' || item.status === 'skipped') {
      completedCount += 1;
      return;
    }
    openCount += 1;
    if (item.graphStatus === 'locked') lockedCount += 1;
    if (item.graphStatus === 'actionable') actionableCount += 1;
    if (Number.isFinite(dueMs)) {
      if (dueMs < nowMs) overdueCount += 1;
      if (dueMs >= nowMs && dueMs <= (nowMs + 7 * DAY_MS)) dueIn7DaysCount += 1;
      if (!nextDueAt || dueMs < Date.parse(nextDueAt)) {
        nextDueAt = new Date(dueMs).toISOString();
      }
    }
  });

  return statsRepo.upsertUserJourneyTodoStats(lineUserId, {
    openCount,
    totalCount,
    completedCount,
    lockedCount,
    actionableCount,
    completionRate: totalCount > 0 ? completedCount / totalCount : 0,
    dependencyBlockRate: openCount > 0 ? lockedCount / openCount : 0,
    overdueCount,
    dueIn7DaysCount,
    nextDueAt,
    lastReminderAt
  });
}

async function syncJourneyTodoPlan(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeLineUserId(payload.lineUserId);
  if (!lineUserId) throw new Error('lineUserId required');

  const profileRepo = resolvedDeps.userJourneyProfilesRepo || userJourneyProfilesRepo;
  const scheduleRepo = resolvedDeps.userJourneySchedulesRepo || userJourneySchedulesRepo;
  const policyRepo = resolvedDeps.journeyPolicyRepo || journeyPolicyRepo;
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;

  const [profile, schedule, policy] = await Promise.all([
    payload.profile || profileRepo.getUserJourneyProfile(lineUserId),
    payload.schedule || scheduleRepo.getUserJourneySchedule(lineUserId),
    payload.journeyPolicy || policyRepo.getJourneyPolicy()
  ]);

  const departureDate = toIsoDate(schedule && schedule.departureDate);
  const assignmentDate = toIsoDate(schedule && schedule.assignmentDate);
  if (!departureDate && !assignmentDate) {
    const graph = await recomputeJourneyTaskGraph({
      lineUserId,
      actor: payload.source || 'journey_sync',
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      failOnCycle: false
    }, resolvedDeps).catch(() => ({ ok: false, reason: 'graph_recompute_failed' }));
    const stats = await refreshJourneyTodoStats(lineUserId, resolvedDeps, payload.now);
    return {
      ok: true,
      lineUserId,
      syncedCount: 0,
      stage: resolveStage(schedule),
      skippedReason: 'schedule_missing',
      stats,
      graph
    };
  }

  const reminderOffsets = Array.isArray(policy && policy.reminder_offsets_days) && policy.reminder_offsets_days.length
    ? policy.reminder_offsets_days
    : [7, 3, 1];
  const nowIso = payload.now || new Date().toISOString();
  const templates = buildBaseTodoTemplates().concat(buildHouseholdTodoTemplates(profile && profile.householdType));

  let syncedCount = 0;
  for (const template of templates) {
    const due = resolveTemplateDueDate(template, schedule || {});
    if (!due) continue;
    const todoKey = template.todoKey;
    const existing = await todoRepo.getJourneyTodoItem(lineUserId, todoKey);
    const remindedOffsetsDays = existing && Array.isArray(existing.remindedOffsetsDays) ? existing.remindedOffsetsDays : [];
    const nextReminderAt = computeNextReminderAt(due.dueAt, reminderOffsets, remindedOffsetsDays, nowIso);

    await todoRepo.upsertJourneyTodoItem(lineUserId, todoKey, {
      lineUserId,
      todoKey,
      title: template.title,
      scenarioKey: profile && profile.scenarioKeyMirror ? profile.scenarioKeyMirror : null,
      householdType: profile && profile.householdType ? profile.householdType : null,
      dueDate: due.dueDate,
      dueAt: due.dueAt,
      status: existing && (existing.status === 'completed' || existing.status === 'skipped') ? existing.status : 'open',
      progressState: existing && existing.progressState ? existing.progressState : 'not_started',
      graphStatus: existing && existing.graphStatus ? existing.graphStatus : 'actionable',
      dependsOn: Array.isArray(template.dependsOn) ? template.dependsOn : [],
      blocks: Array.isArray(template.blocks) ? template.blocks : [],
      priority: Number.isFinite(Number(template.priority)) ? Number(template.priority) : 3,
      riskLevel: template.riskLevel || 'medium',
      lockReasons: existing && Array.isArray(existing.lockReasons) ? existing.lockReasons : [],
      reminderOffsetsDays: reminderOffsets,
      remindedOffsetsDays,
      nextReminderAt,
      reminderCount: existing && Number.isFinite(Number(existing.reminderCount)) ? Number(existing.reminderCount) : 0,
      sourceTemplateVersion: 'journey_todo_v1',
      source: payload.source || 'journey_sync'
    });
    syncedCount += 1;
  }

  const graph = await recomputeJourneyTaskGraph({
    lineUserId,
    actor: payload.source || 'journey_sync',
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    failOnCycle: false
  }, resolvedDeps).catch(() => ({ ok: false, reason: 'graph_recompute_failed' }));

  const stats = await refreshJourneyTodoStats(lineUserId, resolvedDeps, nowIso);
  return {
    ok: true,
    lineUserId,
    syncedCount,
    stage: resolveStage(schedule),
    stats,
    graph
  };
}

module.exports = {
  computeNextReminderAt,
  refreshJourneyTodoStats,
  syncJourneyTodoPlan
};
