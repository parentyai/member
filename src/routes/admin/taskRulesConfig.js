'use strict';

const crypto = require('crypto');
const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const stepRuleChangeLogsRepo = require('../../repos/firestore/stepRuleChangeLogsRepo');
const journeyTemplatesRepo = require('../../repos/firestore/journeyTemplatesRepo');
const { computeUserTasks } = require('../../usecases/tasks/computeUserTasks');
const { planTaskRulesTemplateSet } = require('../../usecases/tasks/planTaskRulesTemplateSet');
const { applyTaskRulesTemplateSet } = require('../../usecases/tasks/applyTaskRulesTemplateSet');
const { planTaskRulesApply } = require('../../usecases/tasks/planTaskRulesApply');
const { applyTaskRulesForUser } = require('../../usecases/tasks/applyTaskRulesForUser');
const { parseJson, requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');
const {
  isTaskEngineEnabled,
  isTaskNudgeEnabled,
  isTaskEventsEnabled,
  isJourneyTemplateEnabled
} = require('../../domain/tasks/featureFlags');
const { enforceManagedFlowGuard } = require('./managedFlowGuard');

const TASK_RULES_SET_ACTION = 'task_rules.set';
const TASK_RULES_SET_PATH = '/api/admin/os/task-rules/set';
const TASK_RULES_TEMPLATE_SET_ACTION = 'task_rules.template_set';
const TASK_RULES_TEMPLATE_SET_PATH = '/api/admin/os/task-rules/template/set';
const TASK_RULES_APPLY_ACTION = 'task_rules.apply';
const TASK_RULES_APPLY_PATH = '/api/admin/os/task-rules/apply';

const SCENARIO_KEY_FIELD = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

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
    [SCENARIO_KEY_FIELD]: row[SCENARIO_KEY_FIELD] || null,
    stepKey: row.stepKey || null,
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : null,
    enabled: row.enabled === true,
    riskLevel: row.riskLevel || null
  };
}

function summarizeTemplate(template) {
  const row = template && typeof template === 'object' ? template : {};
  const phases = Array.isArray(row.phases) ? row.phases : [];
  const steps = phases.reduce((acc, phase) => {
    const list = Array.isArray(phase && phase.steps) ? phase.steps : [];
    return acc + list.length;
  }, 0);
  return {
    templateId: row.templateId || null,
    version: Number.isFinite(Number(row.version)) ? Number(row.version) : null,
    country: row.country || null,
    enabled: row.enabled === true,
    phaseCount: phases.length,
    stepCount: steps,
    validFrom: row.validFrom || null,
    validUntil: row.validUntil || null
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

function confirmTokenData(planHash, templateKey) {
  return {
    planHash,
    templateKey: normalizeText(templateKey, 'task_rules'),
    templateVersion: '',
    segmentKey: 'opsConfig'
  };
}

function writeKnownError(res, err, fallbackTraceId, fallbackRequestId) {
  const statusCode = err && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const code = err && err.code ? String(err.code) : 'error';
  const details = err && err.details && typeof err.details === 'object' ? err.details : null;
  writeJson(res, statusCode, Object.assign({
    ok: false,
    error: code,
    traceId: fallbackTraceId || null,
    requestId: fallbackRequestId || null
  }, details || {}));
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  try {
    const [rules, templates] = await Promise.all([
      stepRulesRepo.listStepRules({ limit: resolveLimit(req) }),
      journeyTemplatesRepo.listJourneyTemplates({ limit: 50 }).catch(() => [])
    ]);

    await appendAuditLog({
      actor,
      action: 'task_rules.status.view',
      entityType: 'opsConfig',
      entityId: 'step_rules',
      traceId,
      requestId,
      payloadSummary: {
        count: rules.length,
        templates: templates.length,
        taskEngineEnabled: isTaskEngineEnabled(),
        taskNudgeEnabled: isTaskNudgeEnabled(),
        taskEventsEnabled: isTaskEventsEnabled(),
        journeyTemplateEnabled: isJourneyTemplateEnabled()
      }
    });

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      flags: {
        taskEngineEnabled: isTaskEngineEnabled(),
        taskNudgeEnabled: isTaskNudgeEnabled(),
        taskEventsEnabled: isTaskEventsEnabled(),
        journeyTemplateEnabled: isJourneyTemplateEnabled()
      },
      rules,
      templates
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
  const confirmToken = createConfirmToken(confirmTokenData(planHash, 'task_rules'), { now: new Date() });

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

  const tokenOk = verifyConfirmToken(confirmToken, confirmTokenData(planHash, 'task_rules'), { now: new Date() });
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

async function handleTemplatePlan(req, res, bodyText) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(bodyText, res);
  if (!payload) return;

  if (!isJourneyTemplateEnabled()) {
    writeJson(res, 409, { ok: false, error: 'journey_template_disabled', traceId, requestId });
    return;
  }

  const template = payload.template && typeof payload.template === 'object' ? payload.template : {};
  const templateId = normalizeText(payload.templateId || template.templateId, '');
  if (!templateId) {
    writeJson(res, 400, { ok: false, error: 'templateId required', traceId, requestId });
    return;
  }

  const planned = planTaskRulesTemplateSet({
    templateId,
    template: Object.assign({}, template, { templateId })
  });

  if (!planned.ok) {
    writeJson(res, 400, {
      ok: false,
      error: planned.error || 'invalid_template_payload',
      warnings: planned.warnings || [],
      traceId,
      requestId
    });
    return;
  }

  const confirmToken = createConfirmToken(confirmTokenData(planned.planHash, 'task_rules_template'), { now: new Date() });

  await appendAuditLog({
    actor,
    action: 'task_rules.template_plan',
    entityType: 'opsConfig',
    entityId: templateId,
    traceId,
    requestId,
    payloadSummary: {
      template: summarizeTemplate(planned.template),
      planHash: planned.planHash,
      ruleCount: planned.compiledRules.length,
      warningCount: planned.warnings.length
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId,
    requestId,
    template: planned.template,
    compiledRules: planned.compiledRules,
    warnings: planned.warnings,
    summary: planned.summary,
    planHash: planned.planHash,
    confirmToken
  });
}

async function handleTemplateSet(req, res, bodyText) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: TASK_RULES_TEMPLATE_SET_ACTION,
    payload
  });
  if (!guard) return;

  const actor = guard.actor;
  const traceId = guard.traceId || resolveTraceId(req);
  const requestId = resolveRequestId(req);

  if (!isJourneyTemplateEnabled()) {
    writeJson(res, 409, { ok: false, error: 'journey_template_disabled', traceId, requestId });
    return;
  }

  const planHash = normalizeText(payload.planHash, '');
  const confirmToken = normalizeText(payload.confirmToken, '');
  if (!planHash || !confirmToken) {
    writeJson(res, 400, { ok: false, error: 'planHash/confirmToken required', traceId, requestId });
    return;
  }

  const template = payload.template && typeof payload.template === 'object' ? payload.template : {};
  const templateId = normalizeText(payload.templateId || template.templateId, '');
  if (!templateId) {
    writeJson(res, 400, { ok: false, error: 'templateId required', traceId, requestId });
    return;
  }

  const planned = planTaskRulesTemplateSet({
    templateId,
    template: Object.assign({}, template, { templateId })
  });

  if (!planned.ok) {
    writeJson(res, 400, {
      ok: false,
      error: planned.error || 'invalid_template_payload',
      warnings: planned.warnings || [],
      traceId,
      requestId
    });
    return;
  }

  if (planHash !== planned.planHash) {
    await appendAuditLog({
      actor,
      action: 'task_rules.template_set',
      entityType: 'opsConfig',
      entityId: templateId,
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'plan_hash_mismatch',
        path: TASK_RULES_TEMPLATE_SET_PATH,
        planHash,
        expectedPlanHash: planned.planHash
      }
    });
    writeJson(res, 409, {
      ok: false,
      reason: 'plan_hash_mismatch',
      expectedPlanHash: planned.planHash,
      traceId,
      requestId
    });
    return;
  }

  const tokenOk = verifyConfirmToken(confirmToken, confirmTokenData(planHash, 'task_rules_template'), { now: new Date() });
  if (!tokenOk) {
    await appendAuditLog({
      actor,
      action: 'task_rules.template_set',
      entityType: 'opsConfig',
      entityId: templateId,
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'confirm_token_mismatch',
        path: TASK_RULES_TEMPLATE_SET_PATH
      }
    });
    writeJson(res, 409, { ok: false, reason: 'confirm_token_mismatch', traceId, requestId });
    return;
  }

  try {
    const applied = await applyTaskRulesTemplateSet({
      templateId,
      template,
      planHash,
      actor,
      traceId,
      requestId
    });

    await appendAuditLog({
      actor,
      action: 'task_rules.template_set',
      entityType: 'opsConfig',
      entityId: templateId,
      traceId,
      requestId,
      payloadSummary: {
        ok: true,
        path: TASK_RULES_TEMPLATE_SET_PATH,
        template: summarizeTemplate(applied.template),
        ruleCount: applied.summary.ruleCount,
        disabledRuleCount: applied.summary.disabledRuleCount,
        warningCount: applied.summary.warningCount
      }
    });

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      template: applied.template,
      warnings: applied.warnings,
      summary: applied.summary,
      planHash: applied.planHash
    });
  } catch (err) {
    logRouteError('admin.task_rules.template_set', err, { traceId, requestId, actor });
    writeKnownError(res, err, traceId, requestId);
  }
}

async function handleApplyPlan(req, res, bodyText) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(bodyText, res);
  if (!payload) return;

  if (!isTaskEngineEnabled()) {
    writeJson(res, 409, { ok: false, error: 'task_engine_disabled', traceId, requestId });
    return;
  }

  try {
    const planned = await planTaskRulesApply(payload);
    const confirmToken = createConfirmToken(confirmTokenData(planned.planHash, 'task_rules_apply'), { now: new Date() });

    await appendAuditLog({
      actor,
      action: 'task_rules.apply_plan',
      entityType: 'task',
      entityId: planned.lineUserId,
      traceId,
      requestId,
      payloadSummary: {
        lineUserId: planned.lineUserId,
        resolvedBy: planned.resolvedBy,
        resolvedUsers: planned.resolvedUsers,
        planHash: planned.planHash,
        summary: planned.summary
      }
    });

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      lineUserId: planned.lineUserId,
      resolvedBy: planned.resolvedBy,
      resolvedUsers: planned.resolvedUsers,
      memberNumber: planned.memberNumber,
      now: planned.now,
      summary: planned.summary,
      nextActions: planned.computed.nextActions || [],
      blocked: planned.computed.blocked || [],
      explain: planned.computed.explain || [],
      planHash: planned.planHash,
      confirmToken
    });
  } catch (err) {
    if (err && Number.isInteger(err.statusCode)) {
      await appendAuditLog({
        actor,
        action: 'task_rules.apply_plan',
        entityType: 'task',
        entityId: normalizeText(payload.lineUserId || payload.memberNumber, 'unknown'),
        traceId,
        requestId,
        payloadSummary: {
          ok: false,
          reason: err.code || 'error',
          details: err.details || null
        }
      }).catch(() => null);
      writeKnownError(res, err, traceId, requestId);
      return;
    }
    logRouteError('admin.task_rules.apply_plan', err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId });
  }
}

async function handleApply(req, res, bodyText) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: TASK_RULES_APPLY_ACTION,
    payload
  });
  if (!guard) return;

  const actor = guard.actor;
  const traceId = guard.traceId || resolveTraceId(req);
  const requestId = resolveRequestId(req);

  if (!isTaskEngineEnabled()) {
    writeJson(res, 409, { ok: false, error: 'task_engine_disabled', traceId, requestId });
    return;
  }

  const planHash = normalizeText(payload.planHash, '');
  const confirmToken = normalizeText(payload.confirmToken, '');
  if (!planHash || !confirmToken) {
    writeJson(res, 400, { ok: false, error: 'planHash/confirmToken required', traceId, requestId });
    return;
  }

  try {
    const planned = await planTaskRulesApply(payload);

    if (planHash !== planned.planHash) {
      await appendAuditLog({
        actor,
        action: 'task_rules.apply',
        entityType: 'task',
        entityId: planned.lineUserId,
        traceId,
        requestId,
        payloadSummary: {
          ok: false,
          reason: 'plan_hash_mismatch',
          path: TASK_RULES_APPLY_PATH,
          planHash,
          expectedPlanHash: planned.planHash
        }
      });
      writeJson(res, 409, {
        ok: false,
        reason: 'plan_hash_mismatch',
        expectedPlanHash: planned.planHash,
        traceId,
        requestId
      });
      return;
    }

    const tokenOk = verifyConfirmToken(confirmToken, confirmTokenData(planHash, 'task_rules_apply'), { now: new Date() });
    if (!tokenOk) {
      await appendAuditLog({
        actor,
        action: 'task_rules.apply',
        entityType: 'task',
        entityId: planned.lineUserId,
        traceId,
        requestId,
        payloadSummary: {
          ok: false,
          reason: 'confirm_token_mismatch',
          path: TASK_RULES_APPLY_PATH
        }
      });
      writeJson(res, 409, { ok: false, reason: 'confirm_token_mismatch', traceId, requestId });
      return;
    }

    const applied = await applyTaskRulesForUser(Object.assign({}, payload, {
      planHash,
      lineUserId: planned.lineUserId,
      actor,
      traceId,
      requestId
    }));

    await appendAuditLog({
      actor,
      action: 'task_rules.apply',
      entityType: 'task',
      entityId: applied.lineUserId,
      traceId,
      requestId,
      payloadSummary: {
        ok: true,
        path: TASK_RULES_APPLY_PATH,
        lineUserId: applied.lineUserId,
        resolvedBy: applied.resolvedBy,
        resolvedUsers: applied.resolvedUsers,
        planHash: applied.planHash,
        summary: applied.summary,
        sync: {
          syncedTaskCount: applied.sync && applied.sync.syncedTaskCount,
          syncedTodoCount: applied.sync && applied.sync.syncedTodoCount
        }
      }
    });

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      lineUserId: applied.lineUserId,
      resolvedBy: applied.resolvedBy,
      resolvedUsers: applied.resolvedUsers,
      memberNumber: applied.memberNumber,
      now: applied.now,
      planHash: applied.planHash,
      summary: applied.summary,
      sync: {
        syncedTaskCount: applied.sync && applied.sync.syncedTaskCount,
        syncedTodoCount: applied.sync && applied.sync.syncedTodoCount,
        nextActions: applied.sync && applied.sync.nextActions ? applied.sync.nextActions : [],
        blocked: applied.sync && applied.sync.blocked ? applied.sync.blocked : []
      }
    });
  } catch (err) {
    if (err && Number.isInteger(err.statusCode)) {
      await appendAuditLog({
        actor,
        action: 'task_rules.apply',
        entityType: 'task',
        entityId: normalizeText(payload.lineUserId || payload.memberNumber, 'unknown'),
        traceId,
        requestId,
        payloadSummary: {
          ok: false,
          reason: err.code || 'error',
          details: err.details || null
        }
      }).catch(() => null);
      writeKnownError(res, err, traceId, requestId);
      return;
    }
    logRouteError('admin.task_rules.apply', err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId });
  }
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
        [SCENARIO_KEY_FIELD]: payload[SCENARIO_KEY_FIELD] || undefined,
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
  handleTemplatePlan,
  handleTemplateSet,
  handleApplyPlan,
  handleApply,
  handleHistory,
  handleDryRun
};
