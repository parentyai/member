'use strict';

const crypto = require('crypto');
const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const stepRuleChangeLogsRepo = require('../../repos/firestore/stepRuleChangeLogsRepo');
const { computeUserTasks } = require('../../usecases/tasks/computeUserTasks');
const { parseJson, requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');
const { isTaskEngineEnabled, isTaskNudgeEnabled } = require('../../domain/tasks/featureFlags');
const { enforceManagedFlowGuard } = require('./managedFlowGuard');

const TASK_RULES_SET_ACTION = 'task_rules.set';
const TASK_RULES_SET_PATH = '/api/admin/os/task-rules/set';

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function resolveLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const parsed = Number(url.searchParams.get('limit') || 100);
  if (!Number.isFinite(parsed) || parsed < 1) return 100;
  return Math.min(Math.floor(parsed), 500);
}

function summarizeRule(rule) {
  const row = rule && typeof rule === 'object' ? rule : {};
  return {
    ruleId: row.ruleId || null,
    scenarioKey: row.scenarioKey || null,
    stepKey: row.stepKey || null,
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : null,
    enabled: row.enabled === true,
    riskLevel: row.riskLevel || null
  };
}

function computePlanHash(action, normalizedRule, enabled) {
  const payload = {
    action,
    ruleId: normalizedRule && normalizedRule.ruleId ? normalizedRule.ruleId : null,
    rule: normalizedRule || null,
    enabled: enabled === true
  };
  return `taskrules_${crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex').slice(0, 24)}`;
}

function confirmTokenData(planHash) {
  return {
    planHash,
    templateKey: 'task_rules',
    templateVersion: '',
    segmentKey: 'opsConfig'
  };
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  try {
    const rules = await stepRulesRepo.listStepRules({ limit: resolveLimit(req) });
    await appendAuditLog({
      actor,
      action: 'task_rules.status.view',
      entityType: 'opsConfig',
      entityId: 'step_rules',
      traceId,
      requestId,
      payloadSummary: {
        count: rules.length,
        taskEngineEnabled: isTaskEngineEnabled(),
        taskNudgeEnabled: isTaskNudgeEnabled()
      }
    });
    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      flags: {
        taskEngineEnabled: isTaskEngineEnabled(),
        taskNudgeEnabled: isTaskNudgeEnabled()
      },
      rules
    });
  } catch (err) {
    logRouteError('admin.task_rules.status', err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId });
  }
}

async function handlePlan(req, res, bodyText) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(bodyText, res);
  if (!payload) return;

  const action = normalizeText(payload.action, 'upsert_rule');
  const ruleInput = payload.rule && typeof payload.rule === 'object' ? payload.rule : {};
  const ruleId = normalizeText(payload.ruleId || ruleInput.ruleId, '');
  const enabled = payload.enabled === true;

  if (!['upsert_rule', 'set_enabled'].includes(action)) {
    writeJson(res, 400, { ok: false, error: 'action invalid', traceId, requestId });
    return;
  }
  if (!ruleId) {
    writeJson(res, 400, { ok: false, error: 'ruleId required', traceId, requestId });
    return;
  }

  const base = await stepRulesRepo.getStepRule(ruleId);
  const candidate = action === 'upsert_rule'
    ? stepRulesRepo.normalizeStepRule(ruleId, Object.assign({}, base || {}, ruleInput, { ruleId }))
    : stepRulesRepo.normalizeStepRule(ruleId, Object.assign({}, base || {}, { ruleId, enabled }));
  if (!candidate) {
    writeJson(res, 400, { ok: false, error: 'invalid rule payload', traceId, requestId });
    return;
  }

  const planHash = computePlanHash(action, candidate, enabled);
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });

  await appendAuditLog({
    actor,
    action: 'task_rules.plan',
    entityType: 'opsConfig',
    entityId: candidate.ruleId,
    traceId,
    requestId,
    payloadSummary: {
      action,
      planHash,
      rule: summarizeRule(candidate)
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId,
    requestId,
    action,
    rule: candidate,
    planHash,
    confirmToken
  });
}

async function handleSet(req, res, bodyText) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: TASK_RULES_SET_ACTION,
    payload
  });
  if (!guard) return;
  const actor = guard.actor;
  const traceId = guard.traceId || resolveTraceId(req);
  const requestId = resolveRequestId(req);

  const action = normalizeText(payload.action, 'upsert_rule');
  const ruleInput = payload.rule && typeof payload.rule === 'object' ? payload.rule : {};
  const ruleId = normalizeText(payload.ruleId || ruleInput.ruleId, '');
  const enabled = payload.enabled === true;
  const planHash = normalizeText(payload.planHash, '');
  const confirmToken = normalizeText(payload.confirmToken, '');

  if (!planHash || !confirmToken) {
    writeJson(res, 400, { ok: false, error: 'planHash/confirmToken required', traceId, requestId });
    return;
  }
  if (!['upsert_rule', 'set_enabled'].includes(action)) {
    writeJson(res, 400, { ok: false, error: 'action invalid', traceId, requestId });
    return;
  }
  if (!ruleId) {
    writeJson(res, 400, { ok: false, error: 'ruleId required', traceId, requestId });
    return;
  }

  const base = await stepRulesRepo.getStepRule(ruleId);
  const candidate = action === 'upsert_rule'
    ? stepRulesRepo.normalizeStepRule(ruleId, Object.assign({}, base || {}, ruleInput, { ruleId }))
    : stepRulesRepo.normalizeStepRule(ruleId, Object.assign({}, base || {}, { ruleId, enabled }));
  if (!candidate) {
    writeJson(res, 400, { ok: false, error: 'invalid rule payload', traceId, requestId });
    return;
  }

  const expectedPlanHash = computePlanHash(action, candidate, enabled);
  if (planHash !== expectedPlanHash) {
    await appendAuditLog({
      actor,
      action: 'task_rules.set',
      entityType: 'opsConfig',
      entityId: ruleId,
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'plan_hash_mismatch',
        path: TASK_RULES_SET_PATH,
        planHash,
        expectedPlanHash
      }
    });
    writeJson(res, 409, { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId, requestId });
    return;
  }

  const tokenOk = verifyConfirmToken(confirmToken, confirmTokenData(planHash), { now: new Date() });
  if (!tokenOk) {
    await appendAuditLog({
      actor,
      action: 'task_rules.set',
      entityType: 'opsConfig',
      entityId: ruleId,
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'confirm_token_mismatch',
        path: TASK_RULES_SET_PATH
      }
    });
    writeJson(res, 409, { ok: false, reason: 'confirm_token_mismatch', traceId, requestId });
    return;
  }

  const saved = await stepRulesRepo.upsertStepRule(ruleId, candidate, actor);
  await stepRuleChangeLogsRepo.appendStepRuleChangeLog({
    action,
    actor,
    ruleId,
    traceId,
    requestId,
    planHash,
    rule: saved,
    summary: summarizeRule(saved),
    createdAt: new Date().toISOString()
  }).catch(() => null);

  await appendAuditLog({
    actor,
    action: 'task_rules.set',
    entityType: 'opsConfig',
    entityId: ruleId,
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      action,
      path: TASK_RULES_SET_PATH,
      rule: summarizeRule(saved)
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId,
    requestId,
    rule: saved
  });
}

async function handleHistory(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  try {
    const limit = resolveLimit(req);
    const items = await stepRuleChangeLogsRepo.listStepRuleChangeLogs(limit).catch(() => []);
    await appendAuditLog({
      actor,
      action: 'task_rules.history.view',
      entityType: 'opsConfig',
      entityId: 'step_rules',
      traceId,
      requestId,
      payloadSummary: {
        count: items.length,
        limit
      }
    });
    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      items
    });
  } catch (err) {
    logRouteError('admin.task_rules.history', err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId });
  }
}

async function handleDryRun(req, res, bodyText) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(bodyText, res);
  if (!payload) return;

  const userId = normalizeText(payload.userId || payload.lineUserId, '');
  if (!userId) {
    writeJson(res, 400, { ok: false, error: 'userId required', traceId, requestId });
    return;
  }

  try {
    const stepRules = Array.isArray(payload.stepRules)
      ? payload.stepRules
      : await stepRulesRepo.listEnabledStepRulesNow({
        now: payload.now || new Date().toISOString(),
        limit: 500,
        scenarioKey: payload.scenarioKey || undefined,
        stepKey: payload.stepKey || undefined
      });
    const result = await computeUserTasks({
      userId,
      lineUserId: userId,
      now: payload.now,
      stepRules,
      killSwitch: payload.killSwitch
    });

    await appendAuditLog({
      actor,
      action: 'task_rules.dry_run',
      entityType: 'task',
      entityId: userId,
      traceId,
      requestId,
      payloadSummary: {
        userId,
        tasks: Array.isArray(result.tasks) ? result.tasks.length : 0,
        blocked: Array.isArray(result.blocked) ? result.blocked.length : 0,
        checkedAt: result.now
      }
    });

    writeJson(res, 200, Object.assign({ ok: true, traceId, requestId }, result));
  } catch (err) {
    logRouteError('admin.task_rules.dry_run', err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId });
  }
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet,
  handleHistory,
  handleDryRun
};
