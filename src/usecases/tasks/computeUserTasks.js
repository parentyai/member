'use strict';

const crypto = require('crypto');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const tasksRepo = require('../../repos/firestore/tasksRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { TASK_STATUS, BLOCKED_REASON, RISK_WEIGHT } = require('../../domain/tasks/constants');
const { normalizeTaskStatus } = require('../../domain/tasks/statusMapping');

const ENGINE_VERSION = 'task_engine_v1';
const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function toMillis(value) {
  const iso = toIso(value);
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasQuietHours(rule, nowIso) {
  const quietHours = rule && rule.constraints && rule.constraints.quietHours
    ? rule.constraints.quietHours
    : null;
  if (!quietHours) return false;
  const nowMs = toMillis(nowIso);
  if (!Number.isFinite(nowMs)) return false;
  const hour = new Date(nowMs).getUTCHours();
  const start = Number(quietHours.startHourUtc);
  const end = Number(quietHours.endHourUtc);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function extractEventKey(event) {
  const row = event && typeof event === 'object' ? event : {};
  return normalizeText(row.eventKey || row.type || (row.ref && row.ref.eventKey), null);
}

function extractEventSource(event) {
  const row = event && typeof event === 'object' ? event : {};
  return normalizeText(row.source || (row.ref && row.ref.source), null);
}

function extractEventOccurredAt(event) {
  const row = event && typeof event === 'object' ? event : {};
  return toIso(row.occurredAt || row.createdAt || (row.ref && row.ref.occurredAt));
}

function extractEventDeadlineAt(event) {
  const row = event && typeof event === 'object' ? event : {};
  return toIso(row.deadlineAt || row.dueAt || row.dueDate || (row.ref && row.ref.deadlineAt));
}

function findMatchedTriggerEvent(rule, events) {
  const trigger = rule && rule.trigger && typeof rule.trigger === 'object' ? rule.trigger : {};
  const targetKey = normalizeText(trigger.eventKey, null);
  const targetSource = normalizeText(trigger.source, null);
  if (!targetKey && !targetSource) return null;
  const list = Array.isArray(events) ? events : [];
  for (const event of list) {
    const key = extractEventKey(event);
    const source = extractEventSource(event);
    if (targetKey && key !== targetKey) continue;
    if (targetSource && source !== targetSource) continue;
    return event;
  }
  return null;
}

function computeDueAt(rule, triggerEvent, existingTask) {
  const leadTime = rule && rule.leadTime && typeof rule.leadTime === 'object' ? rule.leadTime : null;
  if (!leadTime) return null;
  const daysMs = Number(leadTime.days) * 24 * 60 * 60 * 1000;
  if (leadTime.kind === 'after') {
    const baseMs = toMillis(extractEventOccurredAt(triggerEvent));
    if (!Number.isFinite(baseMs)) return null;
    const computed = new Date(baseMs + daysMs).toISOString();
    const existing = toIso(existingTask && existingTask.dueAt);
    if (!existing) return computed;
    return toMillis(existing) <= toMillis(computed) ? existing : computed;
  }
  if (leadTime.kind === 'before_deadline') {
    const deadlineMs = toMillis(extractEventDeadlineAt(triggerEvent));
    if (!Number.isFinite(deadlineMs)) return null;
    const computed = new Date(deadlineMs - daysMs).toISOString();
    const existing = toIso(existingTask && existingTask.dueAt);
    if (!existing) return computed;
    return toMillis(existing) <= toMillis(computed) ? existing : computed;
  }
  return null;
}

function resolveBlockedReason(input) {
  const payload = input && typeof input === 'object' ? input : {};
  if (payload.killSwitch) return BLOCKED_REASON.KILL_SWITCH;
  if (payload.invalidTrigger) return BLOCKED_REASON.INVALID_TRIGGER;
  if (payload.dependencyUnmet) return BLOCKED_REASON.DEPENDENCY_UNMET;
  if (payload.maxActionsReached) return BLOCKED_REASON.MAX_ACTIONS;
  if (payload.planLimitReached) return BLOCKED_REASON.PLAN_LIMIT;
  if (payload.quietHours) return BLOCKED_REASON.QUIET_HOURS;
  return null;
}

function computeDecisionHash(task) {
  const payload = task && typeof task === 'object' ? task : {};
  const raw = JSON.stringify({
    taskId: payload.taskId,
    status: payload.status,
    dueAt: payload.dueAt,
    nextNudgeAt: payload.nextNudgeAt,
    blockedReason: payload.blockedReason,
    sourceEvent: payload.sourceEvent
  });
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 32);
}

function computeDiff(existing, next) {
  if (!existing) return 'create';
  const keys = ['status', 'dueAt', 'nextNudgeAt', 'blockedReason', 'decisionHash'];
  const changed = keys.some((key) => {
    return JSON.stringify(existing[key] || null) !== JSON.stringify(next[key] || null);
  });
  return changed ? 'update' : 'noop';
}

function compareForNextActions(left, right) {
  const a = left && typeof left === 'object' ? left : {};
  const b = right && typeof right === 'object' ? right : {};
  const pA = Number(a.priority);
  const pB = Number(b.priority);
  if (Number.isFinite(pA) && Number.isFinite(pB) && pA !== pB) return pB - pA;
  const rA = RISK_WEIGHT[String(a.riskLevel || '').toLowerCase()] || 0;
  const rB = RISK_WEIGHT[String(b.riskLevel || '').toLowerCase()] || 0;
  if (rA !== rB) return rB - rA;
  const dA = toMillis(a.dueAt);
  const dB = toMillis(b.dueAt);
  if (Number.isFinite(dA) && Number.isFinite(dB) && dA !== dB) return dA - dB;
  return String(a.taskId || '').localeCompare(String(b.taskId || ''), 'ja');
}

function normalizeTaskList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => Object.assign({}, item, {
      status: normalizeTaskStatus(item.status, TASK_STATUS.TODO)
    }));
}

async function computeUserTasks(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const userId = normalizeText(payload.userId || payload.lineUserId, '');
  if (!userId) throw new Error('userId required');

  const nowIso = toIso(payload.now) || new Date().toISOString();
  const tasksRepository = resolvedDeps.tasksRepo || tasksRepo;
  const rulesRepository = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const eventsRepository = resolvedDeps.eventsRepo || eventsRepo;
  const deliveriesRepository = resolvedDeps.deliveriesRepo || deliveriesRepo;
  const killSwitchFn = resolvedDeps.getKillSwitch || systemFlagsRepo.getKillSwitch;

  const [rules, existingTasks, events, deliveries, killSwitch] = await Promise.all([
    Array.isArray(payload.stepRules) ? payload.stepRules : rulesRepository.listEnabledStepRulesNow({ now: nowIso, limit: 1000 }),
    Array.isArray(payload.existingTasks) ? payload.existingTasks : tasksRepository.listTasksByUser({ userId, limit: 1000 }),
    Array.isArray(payload.events) ? payload.events : eventsRepository.listEventsByUser(userId, 1000).catch(() => []),
    Array.isArray(payload.deliveries) ? payload.deliveries : deliveriesRepository.listDeliveriesByUser(userId, 500).catch(() => []),
    typeof payload.killSwitch === 'boolean' ? payload.killSwitch : killSwitchFn().catch(() => false)
  ]);

  const existingByTaskId = new Map(normalizeTaskList(existingTasks).map((task) => [task.taskId, task]));
  const existingDoneByRule = new Set();
  normalizeTaskList(existingTasks).forEach((task) => {
    if (task.ruleId && task.status === TASK_STATUS.DONE) existingDoneByRule.add(task.ruleId);
  });

  const outputs = [];
  const explain = [];
  const blocked = [];
  let activeCount = normalizeTaskList(existingTasks).filter((task) => task.status !== TASK_STATUS.DONE).length;

  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule || typeof rule !== 'object' || !rule.ruleId) continue;
    const taskId = tasksRepo.buildTaskId(userId, rule.ruleId);
    const existing = existingByTaskId.get(taskId) || null;
    const matchedEvent = findMatchedTriggerEvent(rule, events);
    const invalidTrigger = !matchedEvent;
    const dependencyUnmet = Array.isArray(rule.dependsOn)
      && rule.dependsOn.some((depRuleId) => !existingDoneByRule.has(depRuleId));
    const maxActions = Number(rule.constraints && rule.constraints.maxActions);
    const planLimit = Number(rule.constraints && rule.constraints.planLimit);
    const maxActionsReached = Number.isFinite(maxActions) && activeCount >= maxActions;
    const planLimitReached = Number.isFinite(planLimit) && activeCount >= planLimit;
    const quietHours = hasQuietHours(rule, nowIso);

    const blockedReason = resolveBlockedReason({
      killSwitch,
      invalidTrigger,
      dependencyUnmet,
      maxActionsReached,
      planLimitReached,
      quietHours
    });

    const computedDueAt = computeDueAt(rule, matchedEvent, existing);
    const dueAt = computedDueAt || toIso(existing && existing.dueAt);

    if (!existing && !matchedEvent) {
      explain.push({
        ruleId: rule.ruleId,
        taskId,
        decisionKey: 'skip_not_triggered',
        checkedAt: nowIso,
        blockedReason: BLOCKED_REASON.INVALID_TRIGGER
      });
      continue;
    }

    const baseStatus = existing ? normalizeTaskStatus(existing.status, TASK_STATUS.TODO) : TASK_STATUS.TODO;
    let status = baseStatus;
    if (baseStatus !== TASK_STATUS.DONE) {
      if (blockedReason === BLOCKED_REASON.QUIET_HOURS) status = TASK_STATUS.SNOOZED;
      else if (blockedReason) status = TASK_STATUS.BLOCKED;
      else if (baseStatus === TASK_STATUS.BLOCKED || baseStatus === TASK_STATUS.SNOOZED) status = TASK_STATUS.TODO;
      else status = baseStatus || TASK_STATUS.TODO;
    }

    const sourceEvent = matchedEvent
      ? {
        eventId: normalizeText(matchedEvent.id, null),
        eventKey: extractEventKey(matchedEvent),
        source: extractEventSource(matchedEvent),
        occurredAt: extractEventOccurredAt(matchedEvent)
      }
      : (existing && existing.sourceEvent ? existing.sourceEvent : null);

    const nextNudgeAt = status === TASK_STATUS.DONE
      ? null
      : (status === TASK_STATUS.BLOCKED
        ? null
        : (toIso(existing && existing.nextNudgeAt) || dueAt || nowIso));

    const candidate = {
      taskId,
      userId,
      lineUserId: userId,
      [FIELD_SCK]: normalizeText(rule[FIELD_SCK], existing && existing[FIELD_SCK]),
      stepKey: normalizeText(rule.stepKey, existing && existing.stepKey),
      ruleId: rule.ruleId,
      status,
      dueAt,
      nextNudgeAt,
      blockedReason,
      sourceEvent,
      priority: Number(rule.priority) || 0,
      riskLevel: normalizeText(rule.riskLevel, 'medium'),
      engineVersion: ENGINE_VERSION,
      checkedAt: nowIso
    };
    candidate.decisionHash = computeDecisionHash(candidate);
    const decision = computeDiff(existing, candidate);

    candidate.explain = [{
      decisionKey: decision,
      ruleId: rule.ruleId,
      checkedAt: nowIso,
      blockedReason: blockedReason || null,
      inputsHash: crypto.createHash('sha256').update(JSON.stringify({
        trigger: rule.trigger,
        leadTime: rule.leadTime,
        dependsOn: rule.dependsOn,
        sourceEvent
      }), 'utf8').digest('hex').slice(0, 24)
    }];

    outputs.push(candidate);
    if (!existing && candidate.status !== TASK_STATUS.DONE) {
      activeCount += 1;
    }
    explain.push(candidate.explain[0]);
    if (blockedReason) blocked.push(candidate);
  }

  const nextActions = outputs
    .filter((task) => task.status === TASK_STATUS.TODO || task.status === TASK_STATUS.DOING)
    .sort(compareForNextActions)
    .slice(0, 3)
    .map((task) => ({
      taskId: task.taskId,
      ruleId: task.ruleId,
      dueAt: task.dueAt,
      status: task.status,
      [FIELD_SCK]: task[FIELD_SCK],
      stepKey: task.stepKey
    }));

  const decisions = outputs.map((task) => ({
    taskId: task.taskId,
    decisionKey: task.explain && task.explain[0] ? task.explain[0].decisionKey : 'noop'
  }));

  return {
    userId,
    now: nowIso,
    tasks: outputs,
    nextActions,
    blocked,
    explain,
    decisions,
    deliveryCount: Array.isArray(deliveries) ? deliveries.length : 0,
    killSwitch: Boolean(killSwitch)
  };
}

module.exports = {
  ENGINE_VERSION,
  computeUserTasks
};
