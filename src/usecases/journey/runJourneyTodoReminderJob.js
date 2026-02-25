'use strict';

const { pushMessage } = require('../../infra/lineClient');
const journeyPolicyRepo = require('../../repos/firestore/journeyPolicyRepo');
const journeyGraphCatalogRepo = require('../../repos/firestore/journeyGraphCatalogRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const journeyReminderRunsRepo = require('../../repos/firestore/journeyReminderRunsRepo');
const { resolvePlan } = require('../billing/planGate');
const { computeNextReminderAt, refreshJourneyTodoStats } = require('./syncJourneyTodoPlan');

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function normalizeLimit(value, fallback, max) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return fallback;
  return Math.min(Math.floor(num), max);
}

function resolveReminderJobEnabled() {
  const raw = process.env.ENABLE_JOURNEY_REMINDER_JOB;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
}

function resolveJourneyRuleEngineEnabled() {
  const raw = process.env.ENABLE_JOURNEY_RULE_ENGINE_V1;
  if (typeof raw !== 'string') return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on';
}

function normalizeSignal(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function resolveRuleSet(catalog) {
  const payload = catalog && typeof catalog === 'object' ? catalog : {};
  return payload.ruleSet && typeof payload.ruleSet === 'object' ? payload.ruleSet : {};
}

function resolveSignalOffsets(item, ruleSet) {
  const signal = normalizeSignal(item && item.lastSignal);
  const map = ruleSet && typeof ruleSet.signalReminderOffsets === 'object'
    ? ruleSet.signalReminderOffsets
    : null;
  if (signal && map && Array.isArray(map[signal]) && map[signal].length > 0) {
    return map[signal];
  }
  return Array.isArray(item && item.reminderOffsetsDays) ? item.reminderOffsetsDays : [7, 3, 1];
}

function resolveTriggeredOffset(item, nowIso, ruleSet) {
  const dueMs = Date.parse(item && item.dueAt ? item.dueAt : '');
  const nowMs = Date.parse(nowIso || new Date().toISOString());
  if (!Number.isFinite(dueMs) || !Number.isFinite(nowMs)) return null;
  const offsets = resolveSignalOffsets(item, ruleSet);
  const reminded = new Set(Array.isArray(item && item.remindedOffsetsDays) ? item.remindedOffsetsDays.map((value) => Number(value)) : []);
  const matched = offsets
    .map((value) => Number(value))
    .filter((offset) => Number.isInteger(offset) && offset >= 0 && !reminded.has(offset))
    .map((offset) => ({ offset, remindMs: dueMs - (offset * DAY_MS) }))
    .filter((entry) => entry.remindMs <= nowMs)
    .sort((a, b) => b.remindMs - a.remindMs);
  if (!matched.length) return null;
  return matched[0].offset;
}

function parseIso(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldSkipByRuleSet(item, plan, nowIso, ruleSet, perUserState) {
  const nowMs = parseIso(nowIso || new Date().toISOString());
  if (!Number.isFinite(nowMs)) return { skip: false };
  const signal = normalizeSignal(item && item.lastSignal);
  const stopSignals = Array.isArray(ruleSet && ruleSet.stopSignals) ? ruleSet.stopSignals.map((entry) => normalizeSignal(entry)) : [];
  if (signal && stopSignals.includes(signal)) return { skip: true, reason: 'stopped_by_signal' };

  const snoozeMs = parseIso(item && item.snoozeUntil);
  if (Number.isFinite(snoozeMs) && snoozeMs > nowMs) return { skip: true, reason: 'snoozed' };

  const planTier = plan === 'pro' ? 'pro' : 'free';
  const minIntervalHoursByPlan = ruleSet && ruleSet.minIntervalHoursByPlan && typeof ruleSet.minIntervalHoursByPlan === 'object'
    ? ruleSet.minIntervalHoursByPlan
    : {};
  const minIntervalHours = Number(minIntervalHoursByPlan[planTier]);
  const lastReminderAtMs = parseIso(item && item.lastReminderAt);
  if (Number.isFinite(minIntervalHours) && minIntervalHours > 0 && Number.isFinite(lastReminderAtMs)) {
    const minIntervalMs = minIntervalHours * 60 * 60 * 1000;
    if ((nowMs - lastReminderAtMs) < minIntervalMs) return { skip: true, reason: 'frequency_limited' };
  }

  const maxRemindersByPlan = ruleSet && ruleSet.maxRemindersByPlan && typeof ruleSet.maxRemindersByPlan === 'object'
    ? ruleSet.maxRemindersByPlan
    : {};
  const maxReminders = Number(maxRemindersByPlan[planTier]);
  const reminderCount = Number(item && item.reminderCount);
  if (Number.isFinite(maxReminders) && maxReminders >= 0 && Number.isFinite(reminderCount) && reminderCount >= maxReminders) {
    return { skip: true, reason: 'max_reminders_reached' };
  }

  const globalDailyCap = Number(ruleSet && ruleSet.globalDailyCap);
  if (Number.isFinite(globalDailyCap) && globalDailyCap >= 0) {
    const state = perUserState || {};
    const sentToday = Number.isFinite(Number(state.sentToday)) ? Number(state.sentToday) : 0;
    if (sentToday >= globalDailyCap) return { skip: true, reason: 'global_daily_cap' };
  }

  return { skip: false };
}

function buildReminderMessage(item) {
  const title = item && item.title ? item.title : '未対応タスク';
  const dueDate = item && item.dueDate ? item.dueDate : '-';
  const todoKey = item && item.todoKey ? item.todoKey : '-';
  return {
    type: 'text',
    text: `期限が近いTODOがあります。\n[${todoKey}] ${title}\n期限: ${dueDate}\n完了時は「TODO完了:${todoKey}」を送信してください。`
  };
}

async function runJourneyTodoReminderJob(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  const policyRepo = resolvedDeps.journeyPolicyRepo || journeyPolicyRepo;
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;
  const scheduleRepo = resolvedDeps.userJourneySchedulesRepo || userJourneySchedulesRepo;
  const runsRepo = resolvedDeps.journeyReminderRunsRepo || journeyReminderRunsRepo;
  const pushFn = resolvedDeps.pushMessage || pushMessage;
  const planResolver = resolvedDeps.resolvePlan || resolvePlan;
  const catalogRepo = resolvedDeps.journeyGraphCatalogRepo || journeyGraphCatalogRepo;

  const dryRun = normalizeBoolean(payload.dryRun, false);
  const nowIso = payload.now || new Date().toISOString();
  const policy = payload.journeyPolicy || await policyRepo.getJourneyPolicy();
  const ruleEngineEnabled = resolveJourneyRuleEngineEnabled();
  const journeyGraphCatalog = ruleEngineEnabled
    ? await (payload.journeyGraphCatalog || catalogRepo.getJourneyGraphCatalog()).catch(() => null)
    : null;
  const ruleSet = journeyGraphCatalog && journeyGraphCatalog.enabled === true
    ? resolveRuleSet(journeyGraphCatalog)
    : {};
  const maxPerRun = normalizeLimit(policy && policy.reminder_max_per_run, 200, 5000);
  const limit = normalizeLimit(payload.limit, maxPerRun, maxPerRun);

  if (!resolveReminderJobEnabled()) {
    return {
      ok: true,
      status: 'disabled_by_env',
      dryRun,
      scannedCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0
    };
  }

  if (!policy || policy.enabled !== true) {
    return {
      ok: true,
      status: 'disabled_by_policy',
      dryRun,
      scannedCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0
    };
  }

  const run = await runsRepo.createJourneyReminderRun({
    runId: payload.runId,
    dryRun,
    traceId: payload.traceId || null,
    actor: payload.actor || 'journey_todo_reminder_job',
    requestId: payload.requestId || null
  });

  let scannedCount = 0;
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errorSample = [];
  const perUserRuntime = new Map();

  const items = await todoRepo.listDueJourneyTodoItems({
    beforeAt: nowIso,
    limit
  });

  for (const item of items) {
    scannedCount += 1;
    try {
      const lineUserId = item && item.lineUserId ? item.lineUserId : null;
      if (!lineUserId) {
        skippedCount += 1;
        continue;
      }

      if (policy.schedule_required_for_reminders === true) {
        const schedule = await scheduleRepo.getUserJourneySchedule(lineUserId);
        const hasSchedule = schedule && (schedule.departureDate || schedule.assignmentDate);
        if (!hasSchedule) {
          skippedCount += 1;
          continue;
        }
      }

      const planInfo = await planResolver(lineUserId);
      const plan = planInfo && planInfo.plan === 'pro' ? 'pro' : 'free';
      if (policy.paid_only_reminders === true) {
        if (!planInfo || plan !== 'pro') {
          skippedCount += 1;
          continue;
        }
      }

      const userState = perUserRuntime.get(lineUserId) || { sentToday: 0 };
      const ruleDecision = shouldSkipByRuleSet(item, plan, nowIso, ruleSet, userState);
      if (ruleDecision.skip) {
        skippedCount += 1;
        continue;
      }

      const triggeredOffset = resolveTriggeredOffset(item, nowIso, ruleSet);
      if (triggeredOffset === null) {
        skippedCount += 1;
        continue;
      }

      if (!dryRun) {
        await pushFn(lineUserId, buildReminderMessage(item));

        const remindedOffsetsDays = Array.isArray(item.remindedOffsetsDays)
          ? Array.from(new Set(item.remindedOffsetsDays.concat([triggeredOffset]).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0)))
          : [triggeredOffset];
        const reminderCount = Number.isFinite(Number(item.reminderCount)) ? Number(item.reminderCount) + 1 : 1;
        const nextReminderAt = computeNextReminderAt(
          item.dueAt,
          resolveSignalOffsets(item, ruleSet),
          remindedOffsetsDays,
          nowIso
        );

        await todoRepo.upsertJourneyTodoItem(lineUserId, item.todoKey, {
          remindedOffsetsDays,
          reminderCount,
          lastReminderAt: nowIso,
          nextReminderAt,
          journeyState: 'in_progress',
          stateUpdatedAt: nowIso,
          source: 'journey_reminder_job'
        });
        await refreshJourneyTodoStats(lineUserId, resolvedDeps, nowIso);
      }

      sentCount += 1;
      perUserRuntime.set(lineUserId, { sentToday: userState.sentToday + 1 });
    } catch (err) {
      failedCount += 1;
      if (errorSample.length < 20) {
        errorSample.push({
          lineUserId: item && item.lineUserId ? item.lineUserId : null,
          todoKey: item && item.todoKey ? item.todoKey : null,
          message: err && err.message ? String(err.message) : 'error'
        });
      }
    }
  }

  const result = {
    ok: true,
    status: 'completed',
    runId: run.runId,
    dryRun,
    scannedCount,
    sentCount,
    skippedCount,
    failedCount,
    errorSample
  };

  await runsRepo.finishJourneyReminderRun(run.runId, {
    scannedCount,
    sentCount,
    skippedCount,
    failedCount,
    errorSample
  });

  return result;
}

module.exports = {
  runJourneyTodoReminderJob,
  resolveTriggeredOffset
};
