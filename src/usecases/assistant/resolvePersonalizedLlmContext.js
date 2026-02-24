'use strict';

const { resolvePlan } = require('../billing/planGate');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const journeyTodoStatsRepo = require('../../repos/firestore/journeyTodoStatsRepo');

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveContextSummary(context) {
  const payload = context && typeof context === 'object' ? context : {};
  const parts = [];
  parts.push(`plan=${payload.plan || 'free'}`);
  if (payload.householdType) parts.push(`household=${payload.householdType}`);
  if (payload.journeyStage) parts.push(`stage=${payload.journeyStage}`);
  if (payload.departureDate) parts.push(`departure=${payload.departureDate}`);
  if (payload.assignmentDate) parts.push(`assignment=${payload.assignmentDate}`);
  const openCount = Number.isFinite(Number(payload.todoOpenCount)) ? Number(payload.todoOpenCount) : 0;
  const overdueCount = Number.isFinite(Number(payload.todoOverdueCount)) ? Number(payload.todoOverdueCount) : 0;
  parts.push(`todoOpen=${openCount}`);
  parts.push(`todoOverdue=${overdueCount}`);
  if (payload.nextTodoDueAt) parts.push(`nextTodoDueAt=${payload.nextTodoDueAt}`);
  return parts.join(', ');
}

async function resolvePersonalizedLlmContext(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeLineUserId(payload.lineUserId || payload.userId);
  if (!lineUserId) {
    return {
      lineUserId: '',
      plan: 'free',
      subscriptionStatus: 'unknown',
      householdType: null,
      scenarioKeyMirror: null,
      journeyStage: null,
      departureDate: null,
      assignmentDate: null,
      todoOpenCount: 0,
      todoOverdueCount: 0,
      nextTodoDueAt: null,
      summary: 'plan=free, todoOpen=0, todoOverdue=0'
    };
  }

  const profileRepo = resolvedDeps.userJourneyProfilesRepo || userJourneyProfilesRepo;
  const scheduleRepo = resolvedDeps.userJourneySchedulesRepo || userJourneySchedulesRepo;
  const statsRepo = resolvedDeps.journeyTodoStatsRepo || journeyTodoStatsRepo;

  const [planInfo, profile, schedule, todoStats] = await Promise.all([
    resolvePlan(lineUserId),
    profileRepo.getUserJourneyProfile(lineUserId),
    scheduleRepo.getUserJourneySchedule(lineUserId),
    statsRepo.getUserJourneyTodoStats(lineUserId)
  ]);

  const context = {
    lineUserId,
    plan: planInfo.plan,
    subscriptionStatus: planInfo.status,
    householdType: profile && profile.householdType ? profile.householdType : null,
    scenarioKeyMirror: profile && profile.scenarioKeyMirror ? profile.scenarioKeyMirror : null,
    journeyStage: schedule && schedule.stage ? schedule.stage : null,
    departureDate: schedule && schedule.departureDate ? schedule.departureDate : null,
    assignmentDate: schedule && schedule.assignmentDate ? schedule.assignmentDate : null,
    todoOpenCount: todoStats && Number.isFinite(Number(todoStats.openCount)) ? Number(todoStats.openCount) : 0,
    todoOverdueCount: todoStats && Number.isFinite(Number(todoStats.overdueCount)) ? Number(todoStats.overdueCount) : 0,
    nextTodoDueAt: todoStats && todoStats.nextDueAt ? todoStats.nextDueAt : null
  };
  context.summary = resolveContextSummary(context);
  return context;
}

module.exports = {
  resolvePersonalizedLlmContext,
  resolveContextSummary
};
