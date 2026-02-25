'use strict';

const crypto = require('crypto');

const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolvePlan } = require('../../usecases/billing/planGate');
const { applyRichMenuAssignment } = require('../../usecases/journey/applyRichMenuAssignment');
const { resolveRichMenuTemplate } = require('../../usecases/journey/resolveRichMenuTemplate');
const { linkRichMenuToUser } = require('../../infra/lineClient');
const richMenuPolicyRepo = require('../../repos/firestore/richMenuPolicyRepo');
const richMenuTemplatesRepo = require('../../repos/firestore/richMenuTemplatesRepo');
const richMenuPhaseProfilesRepo = require('../../repos/firestore/richMenuPhaseProfilesRepo');
const richMenuAssignmentRulesRepo = require('../../repos/firestore/richMenuAssignmentRulesRepo');
const richMenuRolloutRunsRepo = require('../../repos/firestore/richMenuRolloutRunsRepo');
const richMenuBindingsRepo = require('../../repos/firestore/richMenuBindingsRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { parseJson, requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizePlanTier(value, fallback) {
  const normalized = normalizeText(value, fallback || 'free');
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (lowered === 'pro') return 'paid';
  if (lowered === 'free' || lowered === 'paid') return lowered;
  return null;
}

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function normalizeLocale(value) {
  const normalized = normalizeText(value, 'ja');
  if (!normalized) return 'ja';
  if (normalized.toLowerCase() === 'en') return 'en';
  return 'ja';
}

function normalizeAction(value) {
  const normalized = normalizeText(value, '');
  if (!normalized) return '';
  const lowered = normalized.toLowerCase();
  const allowed = [
    'set_policy',
    'upsert_template',
    'upsert_phase_profile',
    'upsert_rule',
    'set_manual_override',
    'clear_manual_override',
    'apply',
    'rollback'
  ];
  return allowed.includes(lowered) ? lowered : '';
}

function normalizeLineUserIds(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  value.forEach((item) => {
    const normalized = normalizeText(item, '');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function computePlanHash(action, normalizedPayload) {
  const text = `action=${action};payload=${stableStringify(normalizedPayload)}`;
  return `richmenu_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

function confirmTokenData(planHash) {
  return {
    planHash,
    templateKey: 'rich_menu_config',
    templateVersion: '',
    segmentKey: 'opsConfig'
  };
}

function parseLimit(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const raw = Number(url.searchParams.get('limit') || 20);
    if (!Number.isFinite(raw) || raw < 1) return 20;
    return Math.min(Math.floor(raw), 200);
  } catch (_err) {
    return 20;
  }
}

async function normalizeActionPayload(action, rawPayload, deps) {
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  if (action === 'set_policy') {
    const normalized = (resolvedDeps.richMenuPolicyRepo || richMenuPolicyRepo).normalizeRichMenuPolicy(
      payload.policy && typeof payload.policy === 'object' ? payload.policy : payload
    );
    if (!normalized) throw new Error('invalid_policy');
    return normalized;
  }

  if (action === 'upsert_template') {
    const source = payload.template && typeof payload.template === 'object' ? payload.template : payload;
    const normalized = (resolvedDeps.richMenuTemplatesRepo || richMenuTemplatesRepo).normalizeRichMenuTemplate(
      source,
      source && source.templateId
    );
    if (!normalized) throw new Error('invalid_template');
    return normalized;
  }

  if (action === 'upsert_phase_profile') {
    const source = payload.phaseProfile && typeof payload.phaseProfile === 'object' ? payload.phaseProfile : payload;
    const normalized = (resolvedDeps.richMenuPhaseProfilesRepo || richMenuPhaseProfilesRepo).normalizeRichMenuPhaseProfile(
      source,
      source && source.phaseId
    );
    if (!normalized) throw new Error('invalid_phase_profile');
    return normalized;
  }

  if (action === 'upsert_rule') {
    const source = payload.rule && typeof payload.rule === 'object' ? payload.rule : payload;
    const normalized = (resolvedDeps.richMenuAssignmentRulesRepo || richMenuAssignmentRulesRepo).normalizeRichMenuAssignmentRule(
      source,
      source && source.ruleId
    );
    if (!normalized) throw new Error('invalid_rule');
    return normalized;
  }

  if (action === 'set_manual_override') {
    const lineUserId = normalizeText(payload.lineUserId, '');
    const templateId = normalizeText(payload.templateId, '');
    if (!lineUserId || !templateId) throw new Error('lineUserId/templateId required');
    return { lineUserId, templateId };
  }

  if (action === 'clear_manual_override') {
    const lineUserId = normalizeText(payload.lineUserId, '');
    if (!lineUserId) throw new Error('lineUserId required');
    return { lineUserId };
  }

  if (action === 'apply') {
    const lineUserIds = normalizeLineUserIds(payload.lineUserIds || (payload.lineUserId ? [payload.lineUserId] : []));
    if (!lineUserIds.length) throw new Error('lineUserIds required');

    const planTier = payload.planTier === undefined ? null : normalizePlanTier(payload.planTier, null);
    if (planTier === null && payload.planTier !== undefined) throw new Error('invalid_plan_tier');

    const dryRun = normalizeBoolean(payload.dryRun, false);
    if (dryRun === null) throw new Error('invalid_dry_run');

    return {
      lineUserIds,
      planTier,
      journeyStage: normalizeText(payload.journeyStage, null),
      phaseId: normalizeText(payload.phaseId, null),
      householdType: normalizeText(payload.householdType, null),
      locale: normalizeLocale(payload.locale),
      dryRun
    };
  }

  if (action === 'rollback') {
    const lineUserIds = normalizeLineUserIds(payload.lineUserIds || (payload.lineUserId ? [payload.lineUserId] : []));
    if (!lineUserIds.length) throw new Error('lineUserIds required');
    const dryRun = normalizeBoolean(payload.dryRun, false);
    if (dryRun === null) throw new Error('invalid_dry_run');
    return { lineUserIds, dryRun };
  }

  throw new Error('unsupported_action');
}

async function resolveApplyContext(lineUserId, normalizedPayload, deps) {
  const payload = normalizedPayload && typeof normalizedPayload === 'object' ? normalizedPayload : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  const [planInfo, schedule, profile] = await Promise.all([
    payload.planTier ? null : resolvePlan(lineUserId, { userSubscriptionsRepo: resolvedDeps.userSubscriptionsRepo }),
    payload.journeyStage ? null : (resolvedDeps.userJourneySchedulesRepo || userJourneySchedulesRepo).getUserJourneySchedule(lineUserId),
    payload.householdType ? null : (resolvedDeps.userJourneyProfilesRepo || userJourneyProfilesRepo).getUserJourneyProfile(lineUserId)
  ]);

  const planTier = payload.planTier || (planInfo && planInfo.plan === 'pro' ? 'paid' : 'free');
  return {
    lineUserId,
    plan: planTier === 'paid' ? 'pro' : 'free',
    planTier,
    journeyStage: payload.journeyStage || (schedule && schedule.stage ? schedule.stage : null),
    phaseId: payload.phaseId || null,
    householdType: payload.householdType || (profile && profile.householdType ? profile.householdType : null),
    locale: payload.locale || 'ja',
    dryRun: payload.dryRun === true
  };
}

function summarizeApplyResults(results) {
  const rows = Array.isArray(results) ? results : [];
  const summary = {
    total: rows.length,
    okCount: 0,
    appliedCount: 0,
    dryRunCount: 0,
    errorCount: 0,
    statuses: {}
  };
  rows.forEach((item) => {
    if (item && item.ok) summary.okCount += 1;
    if (item && (item.status === 'applied' || item.status === 'applied_fallback')) summary.appliedCount += 1;
    if (item && item.status === 'dry_run') summary.dryRunCount += 1;
    if (item && item.ok === false) summary.errorCount += 1;
    const status = item && typeof item.status === 'string' ? item.status : 'unknown';
    summary.statuses[status] = (summary.statuses[status] || 0) + 1;
  });
  return summary;
}

async function executeApply(normalizedPayload, context, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const policyRepo = resolvedDeps.richMenuPolicyRepo || richMenuPolicyRepo;
  const runsRepo = resolvedDeps.richMenuRolloutRunsRepo || richMenuRolloutRunsRepo;
  const applyAssignment = resolvedDeps.applyRichMenuAssignment || applyRichMenuAssignment;

  const policy = await policyRepo.getRichMenuPolicy();
  const maxTargets = Number.isFinite(Number(policy && policy.maxTargetsPerApply)) ? Number(policy.maxTargetsPerApply) : 200;
  if (normalizedPayload.lineUserIds.length > maxTargets) {
    throw new Error(`maxTargetsPerApply exceeded: ${maxTargets}`);
  }

  const results = [];
  for (const lineUserId of normalizedPayload.lineUserIds) {
    const applyContext = await resolveApplyContext(lineUserId, normalizedPayload, resolvedDeps);
    const result = await applyAssignment(Object.assign({}, applyContext, {
      actor: context.actor,
      traceId: context.traceId,
      richMenuPolicy: policy,
      now: new Date()
    }), resolvedDeps);
    results.push(Object.assign({ lineUserId }, result || {}));
  }

  const summary = summarizeApplyResults(results);
  const run = await runsRepo.appendRichMenuRolloutRun({
    action: 'apply',
    mode: normalizedPayload.dryRun ? 'dry_run' : 'apply',
    actor: context.actor,
    traceId: context.traceId,
    requestId: context.requestId,
    lineUserIds: normalizedPayload.lineUserIds,
    summary,
    results,
    createdAt: new Date().toISOString()
  });

  return {
    ok: true,
    action: 'apply',
    run,
    summary,
    results
  };
}

async function executeRollback(normalizedPayload, context, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const bindingsRepo = resolvedDeps.richMenuBindingsRepo || richMenuBindingsRepo;
  const templatesRepo = resolvedDeps.richMenuTemplatesRepo || richMenuTemplatesRepo;
  const runsRepo = resolvedDeps.richMenuRolloutRunsRepo || richMenuRolloutRunsRepo;

  const results = [];
  const dryRun = normalizedPayload.dryRun === true;
  for (const lineUserId of normalizedPayload.lineUserIds) {
    const binding = await bindingsRepo.getRichMenuBinding(lineUserId);
    const previousTemplateId = binding && typeof binding.previousTemplateId === 'string' ? binding.previousTemplateId.trim() : '';
    if (!previousTemplateId) {
      results.push({ ok: false, lineUserId, status: 'no_previous_template' });
      continue;
    }

    const template = await templatesRepo.getRichMenuTemplate(previousTemplateId);
    const richMenuId = template && template.lineMeta && typeof template.lineMeta.richMenuId === 'string'
      ? template.lineMeta.richMenuId.trim()
      : '';
    if (!template || !richMenuId) {
      results.push({ ok: false, lineUserId, status: 'rollback_target_missing', previousTemplateId });
      continue;
    }

    if (dryRun) {
      results.push({
        ok: true,
        lineUserId,
        status: 'dry_run',
        previousTemplateId,
        richMenuId
      });
      continue;
    }

    try {
      await linkRichMenuToUser(lineUserId, richMenuId);
      await bindingsRepo.upsertRichMenuBinding(lineUserId, {
        previousTemplateId: binding && binding.currentTemplateId ? binding.currentTemplateId : null,
        currentTemplateId: template.templateId,
        currentRichMenuId: richMenuId,
        lastTraceId: context.traceId,
        appliedAt: new Date().toISOString(),
        lastApplyResult: {
          status: 'rolled_back',
          actor: context.actor,
          at: new Date().toISOString(),
          previousTemplateId
        },
        lastError: null
      });
      results.push({ ok: true, lineUserId, status: 'rolled_back', previousTemplateId, richMenuId });
    } catch (err) {
      results.push({
        ok: false,
        lineUserId,
        status: 'error',
        previousTemplateId,
        reason: err && err.message ? String(err.message) : 'rollback_failed'
      });
    }
  }

  const summary = summarizeApplyResults(results);
  const run = await runsRepo.appendRichMenuRolloutRun({
    action: 'rollback',
    mode: dryRun ? 'dry_run' : 'rollback',
    actor: context.actor,
    traceId: context.traceId,
    requestId: context.requestId,
    lineUserIds: normalizedPayload.lineUserIds,
    summary,
    results,
    createdAt: new Date().toISOString()
  });

  return {
    ok: true,
    action: 'rollback',
    run,
    summary,
    results
  };
}

async function executeAction(action, normalizedPayload, context, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  if (action === 'set_policy') {
    const saved = await (resolvedDeps.richMenuPolicyRepo || richMenuPolicyRepo).setRichMenuPolicy(normalizedPayload, context.actor);
    return { ok: true, action, policy: saved };
  }
  if (action === 'upsert_template') {
    const saved = await (resolvedDeps.richMenuTemplatesRepo || richMenuTemplatesRepo).upsertRichMenuTemplate(normalizedPayload, context.actor);
    return { ok: true, action, template: saved };
  }
  if (action === 'upsert_phase_profile') {
    const saved = await (resolvedDeps.richMenuPhaseProfilesRepo || richMenuPhaseProfilesRepo).upsertRichMenuPhaseProfile(normalizedPayload, context.actor);
    return { ok: true, action, phaseProfile: saved };
  }
  if (action === 'upsert_rule') {
    const saved = await (resolvedDeps.richMenuAssignmentRulesRepo || richMenuAssignmentRulesRepo).upsertRichMenuAssignmentRule(normalizedPayload, context.actor);
    return { ok: true, action, rule: saved };
  }
  if (action === 'set_manual_override') {
    const saved = await (resolvedDeps.richMenuBindingsRepo || richMenuBindingsRepo).upsertRichMenuBinding(normalizedPayload.lineUserId, {
      manualOverrideTemplateId: normalizedPayload.templateId,
      lastTraceId: context.traceId,
      lastApplyResult: {
        status: 'manual_override_set',
        actor: context.actor,
        at: new Date().toISOString(),
        templateId: normalizedPayload.templateId
      }
    });
    return { ok: true, action, binding: saved };
  }
  if (action === 'clear_manual_override') {
    const saved = await (resolvedDeps.richMenuBindingsRepo || richMenuBindingsRepo).upsertRichMenuBinding(normalizedPayload.lineUserId, {
      manualOverrideTemplateId: null,
      lastTraceId: context.traceId,
      lastApplyResult: {
        status: 'manual_override_cleared',
        actor: context.actor,
        at: new Date().toISOString()
      }
    });
    return { ok: true, action, binding: saved };
  }
  if (action === 'apply') {
    return executeApply(normalizedPayload, context, resolvedDeps);
  }
  if (action === 'rollback') {
    return executeRollback(normalizedPayload, context, resolvedDeps);
  }

  throw new Error('unsupported_action');
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const [policy, templates, rules, phaseProfiles, runs, globalKillSwitch] = await Promise.all([
    richMenuPolicyRepo.getRichMenuPolicy(),
    richMenuTemplatesRepo.listRichMenuTemplates({ limit: 200 }),
    richMenuAssignmentRulesRepo.listRichMenuAssignmentRules({}),
    richMenuPhaseProfilesRepo.listRichMenuPhaseProfiles({}),
    richMenuRolloutRunsRepo.listRichMenuRolloutRuns(20),
    systemFlagsRepo.getKillSwitch()
  ]);

  await appendAuditLog({
    actor,
    action: 'rich_menu.status.view',
    entityType: 'opsConfig',
    entityId: 'richMenu',
    traceId,
    requestId,
    payloadSummary: {
      templateCount: templates.length,
      ruleCount: rules.length,
      phaseProfileCount: phaseProfiles.length,
      runCount: runs.length,
      enabled: policy.enabled === true,
      globalKillSwitch: Boolean(globalKillSwitch)
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    policy,
    templates,
    rules,
    phaseProfiles,
    runs,
    globalKillSwitch: Boolean(globalKillSwitch),
    serverTime: new Date().toISOString()
  }));
}

async function handleHistory(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);
  const runs = await richMenuRolloutRunsRepo.listRichMenuRolloutRuns(limit).catch(() => []);

  await appendAuditLog({
    actor,
    action: 'rich_menu.history.view',
    entityType: 'opsConfig',
    entityId: 'richMenu',
    traceId,
    requestId,
    payloadSummary: {
      limit,
      count: runs.length
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    runs,
    serverTime: new Date().toISOString()
  }));
}

async function handleResolvePreview(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const lineUserId = normalizeText(payload.lineUserId, '');
  if (!lineUserId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId required', traceId, requestId }));
    return;
  }

  const planTierInput = payload.planTier === undefined ? null : normalizePlanTier(payload.planTier, null);
  if (planTierInput === null && payload.planTier !== undefined) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid planTier', traceId, requestId }));
    return;
  }

  const [planInfo, schedule, profile] = await Promise.all([
    planTierInput ? null : resolvePlan(lineUserId),
    payload.journeyStage ? null : userJourneySchedulesRepo.getUserJourneySchedule(lineUserId),
    payload.householdType ? null : userJourneyProfilesRepo.getUserJourneyProfile(lineUserId)
  ]);

  const planTier = planTierInput || (planInfo && planInfo.plan === 'pro' ? 'paid' : 'free');
  const context = {
    lineUserId,
    planTier,
    plan: planTier === 'paid' ? 'pro' : 'free',
    journeyStage: normalizeText(payload.journeyStage, null) || (schedule && schedule.stage ? schedule.stage : null),
    phaseId: normalizeText(payload.phaseId, null),
    householdType: normalizeText(payload.householdType, null) || (profile && profile.householdType ? profile.householdType : null),
    locale: normalizeLocale(payload.locale)
  };

  const resolution = await resolveRichMenuTemplate(context);

  await appendAuditLog({
    actor,
    action: 'rich_menu.resolve_preview',
    entityType: 'opsConfig',
    entityId: lineUserId,
    traceId,
    requestId,
    payloadSummary: {
      lineUserId,
      planTier,
      journeyStage: context.journeyStage,
      phaseId: resolution && resolution.phaseId ? resolution.phaseId : null,
      source: resolution && resolution.source ? resolution.source : 'none',
      templateId: resolution && resolution.templateId ? resolution.templateId : null,
      richMenuId: resolution && resolution.richMenuId ? resolution.richMenuId : null
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    context,
    resolution,
    serverTime: new Date().toISOString()
  }));
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const action = normalizeAction(payload.action);
  if (!action) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'action required', traceId, requestId }));
    return;
  }

  let normalizedPayload;
  try {
    normalizedPayload = await normalizeActionPayload(action, payload.payload, {});
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: false,
      error: err && err.message ? String(err.message) : 'invalid payload',
      traceId,
      requestId
    }));
    return;
  }

  const planHash = computePlanHash(action, normalizedPayload);
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });

  await appendAuditLog({
    actor,
    action: 'rich_menu.plan',
    entityType: 'opsConfig',
    entityId: 'richMenu',
    traceId,
    requestId,
    payloadSummary: {
      action,
      planHash,
      lineUserCount: Array.isArray(normalizedPayload.lineUserIds) ? normalizedPayload.lineUserIds.length : undefined
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    action,
    payload: normalizedPayload,
    planHash,
    confirmToken,
    serverTime: new Date().toISOString()
  }));
}

async function handleSet(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const action = normalizeAction(payload.action);
  const planHash = normalizeText(payload.planHash, '');
  const confirmToken = normalizeText(payload.confirmToken, '');
  if (!action || !planHash || !confirmToken) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'action/planHash/confirmToken required', traceId, requestId }));
    return;
  }

  let normalizedPayload;
  try {
    normalizedPayload = await normalizeActionPayload(action, payload.payload, {});
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err && err.message ? String(err.message) : 'invalid payload', traceId, requestId }));
    return;
  }

  const expectedPlanHash = computePlanHash(action, normalizedPayload);
  if (expectedPlanHash !== planHash) {
    await appendAuditLog({
      actor,
      action: 'rich_menu.set',
      entityType: 'opsConfig',
      entityId: 'richMenu',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'plan_hash_mismatch',
        action,
        planHash,
        expectedPlanHash
      }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId, requestId }));
    return;
  }

  const tokenValid = verifyConfirmToken(confirmToken, confirmTokenData(planHash), { now: new Date() });
  if (!tokenValid) {
    await appendAuditLog({
      actor,
      action: 'rich_menu.set',
      entityType: 'opsConfig',
      entityId: 'richMenu',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'confirm_token_mismatch',
        action
      }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'confirm_token_mismatch', traceId, requestId }));
    return;
  }

  try {
    const result = await executeAction(action, normalizedPayload, {
      actor,
      traceId,
      requestId
    }, {});

    await appendAuditLog({
      actor,
      action: 'rich_menu.set',
      entityType: 'opsConfig',
      entityId: 'richMenu',
      traceId,
      requestId,
      payloadSummary: {
        ok: true,
        action,
        lineUserCount: Array.isArray(normalizedPayload.lineUserIds) ? normalizedPayload.lineUserIds.length : undefined
      }
    });

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({
      ok: true,
      traceId,
      requestId,
      action,
      serverTime: new Date().toISOString()
    }, result)));
  } catch (err) {
    await appendAuditLog({
      actor,
      action: 'rich_menu.set',
      entityType: 'opsConfig',
      entityId: 'richMenu',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        action,
        reason: err && err.message ? String(err.message) : 'set_failed'
      }
    });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: false,
      error: err && err.message ? String(err.message) : 'set_failed',
      traceId,
      requestId
    }));
  }
}

module.exports = {
  handleStatus,
  handleHistory,
  handleResolvePreview,
  handlePlan,
  handleSet
};
