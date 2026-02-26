'use strict';

const crypto = require('crypto');

const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const journeyParamVersionsRepo = require('../../repos/firestore/journeyParamVersionsRepo');
const journeyParamRuntimeRepo = require('../../repos/firestore/journeyParamRuntimeRepo');
const journeyParamChangeLogsRepo = require('../../repos/firestore/journeyParamChangeLogsRepo');
const { validateJourneyParamVersion } = require('../../usecases/journey/validateJourneyParamVersion');
const { runJourneyParamDryRun } = require('../../usecases/journey/runJourneyParamDryRun');
const {
  applyJourneyParamVersion,
  rollbackJourneyParamVersion
} = require('../../usecases/journey/applyJourneyParamVersion');
const { parseJson, requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function resolveFlag(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return fallback === true;
}

function parseLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('limit') || 20);
  if (!Number.isFinite(raw) || raw < 1) return 20;
  return Math.min(Math.floor(raw), 100);
}

function clone(value, fallback) {
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return JSON.parse(JSON.stringify(base));
  return JSON.parse(JSON.stringify(value));
}

function serializeVersion(version) {
  const payload = version && typeof version === 'object' ? version : {};
  return JSON.stringify({
    versionId: payload.versionId || null,
    schemaVersion: Number.isFinite(Number(payload.schemaVersion)) ? Math.max(1, Math.floor(Number(payload.schemaVersion))) : 1,
    effectiveAt: payload.effectiveAt || null,
    parameters: payload.parameters && typeof payload.parameters === 'object' ? payload.parameters : {},
    note: payload.note || null
  });
}

function computePlanHash(version) {
  return `journeyparam_${crypto.createHash('sha256').update(serializeVersion(version), 'utf8').digest('hex').slice(0, 24)}`;
}

function computeRollbackPlanHash(currentVersionId, rollbackToVersionId) {
  const text = JSON.stringify({
    action: 'rollback',
    currentVersionId: currentVersionId || null,
    rollbackToVersionId: rollbackToVersionId || null
  });
  return `journeyparamrb_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

function confirmTokenData(planHash) {
  return {
    planHash,
    templateKey: 'journey_param_version',
    templateVersion: '',
    segmentKey: 'opsConfig'
  };
}

function buildSummary(version) {
  const payload = version && typeof version === 'object' ? version : {};
  const dryRun = payload.dryRun && typeof payload.dryRun === 'object' ? payload.dryRun : {};
  const metrics = dryRun.metrics && typeof dryRun.metrics === 'object' ? dryRun.metrics : {};
  return {
    versionId: payload.versionId || null,
    state: payload.state || 'draft',
    cycleCount: Number.isFinite(Number(payload.validation && payload.validation.cycleCount))
      ? Math.floor(Number(payload.validation.cycleCount))
      : 0,
    dryRunHash: dryRun.hash || null,
    impactedUsers: Number.isFinite(Number(metrics.impactedUsers)) ? Math.floor(Number(metrics.impactedUsers)) : 0,
    additionalNotifications: Number.isFinite(Number(metrics.additionalNotifications)) ? Math.floor(Number(metrics.additionalNotifications)) : 0,
    disabledNodes: Number.isFinite(Number(metrics.disabledNodes)) ? Math.floor(Number(metrics.disabledNodes)) : 0,
    deadlineBreachForecast: Number.isFinite(Number(metrics.deadlineBreachForecast)) ? Math.floor(Number(metrics.deadlineBreachForecast)) : 0
  };
}

function mergeParameters(base, patch) {
  const b = base && typeof base === 'object' ? base : {};
  const p = patch && typeof patch === 'object' ? patch : {};
  return {
    graph: Object.assign({}, clone(b.graph, {}), clone(p.graph, {})),
    journeyPolicy: Object.assign({}, clone(b.journeyPolicy, {}), clone(p.journeyPolicy, {})),
    llmPolicyPatch: Object.assign({}, clone(b.llmPolicyPatch, {}), clone(p.llmPolicyPatch, {}))
  };
}

function mergeVersionDraft(base, patch, actor) {
  const current = base && typeof base === 'object' ? base : {};
  const payload = patch && typeof patch === 'object' ? patch : {};
  const parametersPatch = payload.parameters && typeof payload.parameters === 'object' ? payload.parameters : {};
  return {
    versionId: current.versionId || undefined,
    state: 'draft',
    schemaVersion: Number.isFinite(Number(payload.schemaVersion))
      ? Math.max(1, Math.floor(Number(payload.schemaVersion)))
      : (Number.isFinite(Number(current.schemaVersion)) ? Math.max(1, Math.floor(Number(current.schemaVersion))) : 1),
    effectiveAt: payload.effectiveAt === undefined ? current.effectiveAt || null : payload.effectiveAt,
    previousAppliedVersionId: payload.previousAppliedVersionId === undefined
      ? current.previousAppliedVersionId || null
      : payload.previousAppliedVersionId,
    parameters: mergeParameters(current.parameters, parametersPatch),
    validation: payload.validation && typeof payload.validation === 'object'
      ? payload.validation
      : (current.validation || { ok: false, errors: [], warnings: [], cycleCount: 0 }),
    dryRun: payload.dryRun && typeof payload.dryRun === 'object'
      ? payload.dryRun
      : (current.dryRun || { ok: false, metrics: {}, scope: {}, generatedAt: null, hash: null }),
    appliedMeta: current.appliedMeta || {
      actor: null,
      traceId: null,
      requestId: null,
      appliedAt: null,
      rollbackAt: null
    },
    note: payload.note === undefined ? (current.note || null) : payload.note,
    createdBy: current.createdBy || actor,
    updatedBy: actor
  };
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const [runtime, recentVersions] = await Promise.all([
    journeyParamRuntimeRepo.getJourneyParamRuntime().catch(() => null),
    journeyParamVersionsRepo.listJourneyParamVersions(20).catch(() => [])
  ]);
  const activeVersionId = runtime && typeof runtime.activeVersionId === 'string' ? runtime.activeVersionId : null;
  const canaryVersionId = runtime && runtime.canary && typeof runtime.canary.versionId === 'string'
    ? runtime.canary.versionId
    : null;
  const [activeVersion, canaryVersion] = await Promise.all([
    activeVersionId ? journeyParamVersionsRepo.getJourneyParamVersion(activeVersionId).catch(() => null) : Promise.resolve(null),
    canaryVersionId ? journeyParamVersionsRepo.getJourneyParamVersion(canaryVersionId).catch(() => null) : Promise.resolve(null)
  ]);

  const flags = {
    versioningEnabled: resolveFlag('ENABLE_JOURNEY_PARAM_VERSIONING_V1', false),
    canaryEnabled: resolveFlag('ENABLE_JOURNEY_PARAM_CANARY_V1', false)
  };

  await appendAuditLog({
    actor,
    action: 'journey_param.status.view',
    entityType: 'opsConfig',
    entityId: 'journeyParamRuntime',
    traceId,
    requestId,
    payloadSummary: {
      activeVersionId,
      canaryVersionId,
      recentCount: recentVersions.length,
      flags
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    runtime,
    activeVersion,
    canaryVersion,
    versions: recentVersions,
    flags,
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

  const action = normalizeText(payload.action, 'draft_plan');
  if (action === 'rollback_plan') {
    const runtime = await journeyParamRuntimeRepo.getJourneyParamRuntime().catch(() => null);
    const currentVersionId = normalizeText(payload.versionId, runtime && runtime.activeVersionId ? runtime.activeVersionId : '');
    const rollbackToVersionId = normalizeText(
      payload.rollbackToVersionId,
      runtime && runtime.previousAppliedVersionId ? runtime.previousAppliedVersionId : ''
    );
    if (!currentVersionId || !rollbackToVersionId) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: false,
        error: 'versionId/rollbackToVersionId required',
        traceId,
        requestId
      }));
      return;
    }

    const planHash = computeRollbackPlanHash(currentVersionId, rollbackToVersionId);
    const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });

    await appendAuditLog({
      actor,
      action: 'journey_param.rollback.plan',
      entityType: 'journey_param',
      entityId: currentVersionId,
      traceId,
      requestId,
      payloadSummary: {
        currentVersionId,
        rollbackToVersionId,
        planHash
      }
    });

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      action,
      traceId,
      requestId,
      currentVersionId,
      rollbackToVersionId,
      planHash,
      confirmToken,
      serverTime: new Date().toISOString()
    }));
    return;
  }

  const versionId = normalizeText(payload.versionId, '');
  const existing = versionId ? await journeyParamVersionsRepo.getJourneyParamVersion(versionId).catch(() => null) : null;
  if (versionId && !existing) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'journey_param_version_not_found', traceId, requestId }));
    return;
  }
  if (existing && existing.state !== 'draft') {
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'version_not_draft', traceId, requestId }));
    return;
  }

  const candidate = mergeVersionDraft(existing, payload, actor);
  let saved = null;
  if (existing) {
    const normalizedCandidate = journeyParamVersionsRepo.normalizeJourneyParamVersion(
      Object.assign({}, candidate, { versionId: existing.versionId }),
      existing.versionId
    );
    if (!normalizedCandidate) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'invalid journeyParamVersion', traceId, requestId }));
      return;
    }
    saved = await journeyParamVersionsRepo.setJourneyParamVersion(existing.versionId, normalizedCandidate, actor);
  } else {
    saved = await journeyParamVersionsRepo.createJourneyParamVersion(candidate, actor);
  }

  const planHash = computePlanHash(saved);
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });

  await journeyParamChangeLogsRepo.appendJourneyParamChangeLog({
    actor,
    traceId,
    requestId,
    versionId: saved.versionId,
    action: 'plan',
    summary: Object.assign({ action: 'plan', stateFrom: existing ? existing.state : null, stateTo: 'draft', planHash }, buildSummary(saved)),
    before: existing,
    after: saved,
    createdAt: new Date().toISOString()
  }).catch(() => null);

  await appendAuditLog({
    actor,
    action: 'journey_param.plan',
    entityType: 'journey_param',
    entityId: saved.versionId,
    traceId,
    requestId,
    payloadSummary: Object.assign({ planHash }, buildSummary(saved))
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    action,
    traceId,
    requestId,
    version: saved,
    planHash,
    confirmToken,
    serverTime: new Date().toISOString()
  }));
}

async function handleValidate(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const versionId = normalizeText(payload.versionId, '');
  if (!versionId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'versionId required', traceId, requestId }));
    return;
  }

  const before = await journeyParamVersionsRepo.getJourneyParamVersion(versionId).catch(() => null);
  if (!before) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'journey_param_version_not_found', traceId, requestId }));
    return;
  }

  const validation = await validateJourneyParamVersion({ versionId }, {});
  const stateTo = validation.ok ? 'validated' : 'rejected';
  const after = await journeyParamVersionsRepo.patchJourneyParamVersion(versionId, {
    state: stateTo,
    validation: {
      ok: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
      cycleCount: validation.cycleCount,
      validatedAt: validation.validatedAt
    }
  }, actor).catch(() => before);

  await journeyParamChangeLogsRepo.appendJourneyParamChangeLog({
    actor,
    traceId,
    requestId,
    versionId,
    action: 'validate',
    summary: Object.assign({ action: 'validate', stateFrom: before.state, stateTo }, buildSummary(after)),
    before,
    after,
    createdAt: new Date().toISOString()
  }).catch(() => null);

  await appendAuditLog({
    actor,
    action: 'journey_param.validate',
    entityType: 'journey_param',
    entityId: versionId,
    traceId,
    requestId,
    payloadSummary: {
      ok: validation.ok,
      stateTo,
      cycleCount: validation.cycleCount,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    versionId,
    validation,
    version: after,
    serverTime: new Date().toISOString()
  }));
}

async function handleDryRun(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const versionId = normalizeText(payload.versionId, '');
  if (!versionId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'versionId required', traceId, requestId }));
    return;
  }

  const before = await journeyParamVersionsRepo.getJourneyParamVersion(versionId).catch(() => null);
  if (!before) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'journey_param_version_not_found', traceId, requestId }));
    return;
  }
  if (!['validated', 'dry_run_passed', 'applied'].includes(before.state)) {
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'version_not_validated', traceId, requestId }));
    return;
  }

  const dryRun = await runJourneyParamDryRun({
    versionId,
    scope: payload.scope,
    horizonDays: payload.horizonDays,
    nowMs: payload.nowMs
  }, {});

  const canTransitionToDryRunPassed = before.state === 'validated';
  const after = await journeyParamVersionsRepo.patchJourneyParamVersion(versionId, {
    state: canTransitionToDryRunPassed ? 'dry_run_passed' : before.state,
    dryRun
  }, actor, {
    skipStateTransitionCheck: before.state !== 'validated'
  }).catch(() => before);

  await journeyParamChangeLogsRepo.appendJourneyParamChangeLog({
    actor,
    traceId,
    requestId,
    versionId,
    action: 'dry_run',
    summary: Object.assign({ action: 'dry_run', stateFrom: before.state, stateTo: after.state }, buildSummary(after)),
    before,
    after,
    createdAt: new Date().toISOString()
  }).catch(() => null);

  await appendAuditLog({
    actor,
    action: 'journey_param.dry_run',
    entityType: 'journey_param',
    entityId: versionId,
    traceId,
    requestId,
    payloadSummary: {
      stateFrom: before.state,
      stateTo: after.state,
      metrics: dryRun.metrics || {},
      hash: dryRun.hash || null
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    versionId,
    dryRun,
    version: after,
    serverTime: new Date().toISOString()
  }));
}

async function handleApply(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const versionId = normalizeText(payload.versionId, '');
  const planHash = normalizeText(payload.planHash, '');
  const confirmToken = normalizeText(payload.confirmToken, '');
  const latestDryRunHash = normalizeText(payload.latestDryRunHash, '');
  if (!versionId || !planHash || !confirmToken || !latestDryRunHash) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'versionId/planHash/confirmToken/latestDryRunHash required', traceId, requestId }));
    return;
  }

  const version = await journeyParamVersionsRepo.getJourneyParamVersion(versionId).catch(() => null);
  if (!version) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'journey_param_version_not_found', traceId, requestId }));
    return;
  }
  if (version.state !== 'dry_run_passed') {
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'dry_run_required', state: version.state, traceId, requestId }));
    return;
  }

  const expectedPlanHash = computePlanHash(version);
  if (planHash !== expectedPlanHash) {
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId, requestId }));
    return;
  }
  if ((version.dryRun && version.dryRun.hash) !== latestDryRunHash) {
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'dry_run_hash_mismatch', expectedDryRunHash: version.dryRun && version.dryRun.hash ? version.dryRun.hash : null, traceId, requestId }));
    return;
  }
  const tokenValid = verifyConfirmToken(confirmToken, confirmTokenData(planHash), { now: new Date() });
  if (!tokenValid) {
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'confirm_token_mismatch', traceId, requestId }));
    return;
  }

  const result = await applyJourneyParamVersion({
    versionId,
    actor,
    traceId,
    requestId,
    action: 'apply'
  }, {});

  await appendAuditLog({
    actor,
    action: 'journey_param.apply',
    entityType: 'journey_param',
    entityId: versionId,
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      previousAppliedVersionId: result && result.version ? result.version.previousAppliedVersionId || null : null,
      activeVersionId: result && result.runtime ? result.runtime.activeVersionId || null : null
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(Object.assign({
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString()
  }, result)));
}

async function handleRollback(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const runtime = await journeyParamRuntimeRepo.getJourneyParamRuntime().catch(() => null);
  const versionId = normalizeText(payload.versionId, runtime && runtime.activeVersionId ? runtime.activeVersionId : '');
  const rollbackToVersionId = normalizeText(
    payload.rollbackToVersionId,
    runtime && runtime.previousAppliedVersionId ? runtime.previousAppliedVersionId : ''
  );
  const planHash = normalizeText(payload.planHash, '');
  const confirmToken = normalizeText(payload.confirmToken, '');

  if (!versionId || !rollbackToVersionId || !planHash || !confirmToken) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'versionId/rollbackToVersionId/planHash/confirmToken required', traceId, requestId }));
    return;
  }

  const expectedPlanHash = computeRollbackPlanHash(versionId, rollbackToVersionId);
  if (expectedPlanHash !== planHash) {
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId, requestId }));
    return;
  }
  const tokenValid = verifyConfirmToken(confirmToken, confirmTokenData(planHash), { now: new Date() });
  if (!tokenValid) {
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'confirm_token_mismatch', traceId, requestId }));
    return;
  }

  const result = await rollbackJourneyParamVersion({
    versionId,
    rollbackToVersionId,
    actor,
    traceId,
    requestId
  }, {});

  await appendAuditLog({
    actor,
    action: 'journey_param.rollback',
    entityType: 'journey_param',
    entityId: versionId,
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      rollbackToVersionId,
      activeVersionId: result && result.runtime ? result.runtime.activeVersionId || null : null
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(Object.assign({
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString()
  }, result)));
}

async function handleHistory(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);

  const [changes, versions] = await Promise.all([
    journeyParamChangeLogsRepo.listJourneyParamChangeLogs(limit).catch(() => []),
    journeyParamVersionsRepo.listJourneyParamVersions(limit).catch(() => [])
  ]);

  await appendAuditLog({
    actor,
    action: 'journey_param.history.view',
    entityType: 'journey_param',
    entityId: 'journey_param_versions',
    traceId,
    requestId,
    payloadSummary: {
      limit,
      changeCount: changes.length,
      versionCount: versions.length
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    limit,
    changes,
    versions
  }));
}

module.exports = {
  computePlanHash,
  computeRollbackPlanHash,
  handleStatus,
  handlePlan,
  handleValidate,
  handleDryRun,
  handleApply,
  handleRollback,
  handleHistory
};
