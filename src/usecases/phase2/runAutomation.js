'use strict';

const {
  listAllEvents,
  listEventsByCreatedAtRange,
  listAllUsers,
  listAllChecklists,
  listAllUserChecklists
} = require('../../repos/firestore/analyticsReadRepo');
const {
  upsertDailyEventReport,
  upsertWeeklyEventReport,
  upsertChecklistPendingReport
} = require('../../repos/firestore/scenarioReportsRepo');
const { upsertRun } = require('../../repos/firestore/scenarioRunsRepo');

const DEFAULT_ANALYTICS_LIMIT = 1000;
const MAX_ANALYTICS_LIMIT = 5000;
const FALLBACK_MODE_ALLOW = 'allow';
const FALLBACK_MODE_BLOCK = 'block';

function isEnabled() {
  return String(process.env.PHASE2_AUTOMATION_ENABLED || '').toLowerCase() === 'true';
}

function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function resolveAnalyticsLimit(value) {
  if (value === undefined || value === null) return DEFAULT_ANALYTICS_LIMIT;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_ANALYTICS_LIMIT;
  return Math.min(Math.floor(num), MAX_ANALYTICS_LIMIT);
}

function resolveFallbackMode(value) {
  if (typeof value !== 'string' || !value.trim()) return FALLBACK_MODE_ALLOW;
  const normalized = value.trim().toLowerCase();
  if (normalized === FALLBACK_MODE_BLOCK) return FALLBACK_MODE_BLOCK;
  return FALLBACK_MODE_ALLOW;
}

function dateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function weekStartDateUtc(date) {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7; // Monday=0
  const start = startOfUtcDay(date);
  start.setUTCDate(start.getUTCDate() - diff);
  return start;
}

function weekEndDateUtc(date) {
  const start = weekStartDateUtc(date);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 7);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return end;
}

function weekStartKey(date) {
  return dateKey(weekStartDateUtc(date));
}

function ensureCounts() {
  return { open: 0, click: 0, complete: 0 };
}

async function runPhase2Automation({ runId, targetDate, dryRun, logger, analyticsLimit, fallbackMode }) {
  if (!isEnabled()) return { ok: false, error: 'automation disabled' };
  if (typeof runId !== 'string' || runId.trim().length === 0) return { ok: false, error: 'runId required' };
  if (!isValidDateString(targetDate)) return { ok: false, error: 'targetDate required' };
  if (typeof dryRun !== 'boolean') return { ok: false, error: 'dryRun required' };

  const log = typeof logger === 'function' ? logger : () => {};
  const startedAt = Date.now();
  const summary = {
    runId,
    targetDate,
    dryRun,
    counts: {
      eventsProcessed: 0,
      dailyReports: 0,
      weeklyReports: 0,
      checklistReports: 0,
      skipped: 0
    }
  };
  const resolvedAnalyticsLimit = resolveAnalyticsLimit(analyticsLimit);
  const resolvedFallbackMode = resolveFallbackMode(fallbackMode);
  const fallbackBlocked = resolvedFallbackMode === FALLBACK_MODE_BLOCK;
  summary.readPath = {
    analyticsLimit: resolvedAnalyticsLimit,
    eventsSource: 'range',
    fallbackMode: resolvedFallbackMode
  };

  try {
    const targetDateObj = new Date(`${targetDate}T00:00:00Z`);
    const rangeFrom = weekStartDateUtc(targetDateObj);
    const rangeTo = weekEndDateUtc(targetDateObj);

    let events = await listEventsByCreatedAtRange({
      limit: resolvedAnalyticsLimit,
      fromAt: rangeFrom,
      toAt: rangeTo
    });
    if (!Array.isArray(events) || events.length === 0) {
      if (!fallbackBlocked) {
        events = await listAllEvents({ limit: resolvedAnalyticsLimit });
        summary.readPath.eventsSource = 'fallback_all';
      } else {
        events = [];
        summary.readPath.eventsSource = 'not_available';
        summary.readPath.fallbackBlocked = true;
        summary.readPath.fallbackSources = ['listAllEvents'];
      }
    }

    const [users, checklists, userChecklists] = fallbackBlocked
      ? [[], [], []]
      : await Promise.all([
        listAllUsers({ limit: resolvedAnalyticsLimit }),
        listAllChecklists({ limit: resolvedAnalyticsLimit }),
        listAllUserChecklists({ limit: resolvedAnalyticsLimit })
      ]);
    if (fallbackBlocked) {
      summary.readPath.userSource = 'not_available';
      summary.readPath.checklistSource = 'not_available';
      summary.readPath.userChecklistSource = 'not_available';
      summary.readPath.fallbackBlocked = true;
      summary.readPath.fallbackSources = ['listAllUsers', 'listAllChecklists', 'listAllUserChecklists'];
      if (summary.readPath.eventsSource === 'range') {
        summary.readPath.eventsSource = 'range_only';
      }
    }

    const userScenario = new Map();
    for (const user of users) {
      const scenario = user.data && user.data.scenario;
      if (scenario) userScenario.set(user.id, scenario);
    }

    const dailyCounts = new Map();
    const weeklyCounts = new Map();
    const targetWeekStart = weekStartKey(new Date(`${targetDate}T00:00:00Z`));

    for (const event of events) {
      const data = event.data || {};
      const eventDate = toDate(data.createdAt);
      if (!eventDate) {
        summary.counts.skipped += 1;
        continue;
      }
      const eventDateKey = dateKey(eventDate);
      const scenario = userScenario.get(data.lineUserId);
      if (!scenario) {
        summary.counts.skipped += 1;
        continue;
      }

      if (eventDateKey === targetDate) {
        const counts = dailyCounts.get(scenario) || ensureCounts();
        if (data.type === 'open' || data.type === 'click' || data.type === 'complete') {
          counts[data.type] += 1;
          dailyCounts.set(scenario, counts);
          summary.counts.eventsProcessed += 1;
        } else {
          summary.counts.skipped += 1;
        }
      }

      const eventWeekStart = weekStartKey(eventDate);
      if (eventWeekStart === targetWeekStart) {
        const counts = weeklyCounts.get(scenario) || ensureCounts();
        if (data.type === 'open' || data.type === 'click' || data.type === 'complete') {
          counts[data.type] += 1;
          weeklyCounts.set(scenario, counts);
        }
      }
    }

    const checklistMap = new Map();
    for (const checklist of checklists) {
      const data = checklist.data || {};
      const items = Array.isArray(data.items) ? data.items : [];
      checklistMap.set(checklist.id, {
        scenario: data.scenario,
        step: data.step,
        itemsCount: items.length
      });
    }

    const userCountByScenario = {};
    for (const scenario of userScenario.values()) {
      userCountByScenario[scenario] = (userCountByScenario[scenario] || 0) + 1;
    }

    const completedByChecklist = new Map();
    for (const record of userChecklists) {
      const data = record.data || {};
      if (!data.checklistId) continue;
      if (!data.completedAt) continue;
      const current = completedByChecklist.get(data.checklistId) || 0;
      completedByChecklist.set(data.checklistId, current + 1);
    }

    const pendingByScenarioStep = new Map();
    for (const [checklistId, meta] of checklistMap.entries()) {
      if (!meta || !meta.scenario || !meta.step) continue;
      const usersCount = userCountByScenario[meta.scenario] || 0;
      const totalTargets = usersCount * meta.itemsCount;
      const completedCount = completedByChecklist.get(checklistId) || 0;
      const pendingCount = Math.max(totalTargets - completedCount, 0);
      const key = `${meta.scenario}__${meta.step}`;
      const current = pendingByScenarioStep.get(key) || {
        scenario: meta.scenario,
        step: meta.step,
        totalTargets: 0,
        completedCount: 0,
        pendingCount: 0
      };
      current.totalTargets += totalTargets;
      current.completedCount += completedCount;
      current.pendingCount += pendingCount;
      pendingByScenarioStep.set(key, current);
    }

    summary.counts.dailyReports = dailyCounts.size;
    summary.counts.weeklyReports = weeklyCounts.size;
    summary.counts.checklistReports = pendingByScenarioStep.size;

    if (!dryRun) {
      await upsertRun(runId, {
        runId,
        targetDate,
        dryRun,
        status: 'running',
        counts: summary.counts,
        createdAt: new Date(startedAt)
      });

      for (const [scenario, counts] of dailyCounts.entries()) {
        await upsertDailyEventReport({ date: targetDate, scenario, counts, runId });
      }
      for (const [scenario, counts] of weeklyCounts.entries()) {
        await upsertWeeklyEventReport({ weekStart: targetWeekStart, scenario, counts, runId });
      }
      for (const report of pendingByScenarioStep.values()) {
        await upsertChecklistPendingReport({
          date: targetDate,
          scenario: report.scenario,
          step: report.step,
          totalTargets: report.totalTargets,
          completedCount: report.completedCount,
          pendingCount: report.pendingCount,
          runId
        });
      }

      const durationMs = Date.now() - startedAt;
      await upsertRun(runId, {
        status: 'success',
        counts: summary.counts,
        durationMs,
        finishedAt: new Date()
      });
    }

    log(`[phase2] runId=${runId} dryRun=${dryRun} targetDate=${targetDate}`);
    return { ok: true, summary };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    if (!dryRun) {
      await upsertRun(runId, {
        status: 'failed',
        counts: summary.counts,
        durationMs,
        finishedAt: new Date()
      });
    }
    return { ok: false, error: err && err.message ? err.message : 'automation failed' };
  }
}

module.exports = {
  runPhase2Automation
};
