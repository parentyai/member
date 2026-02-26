'use strict';

const journeyParamVersionsRepo = require('../../repos/firestore/journeyParamVersionsRepo');
const journeyParamRuntimeRepo = require('../../repos/firestore/journeyParamRuntimeRepo');
const journeyParamChangeLogsRepo = require('../../repos/firestore/journeyParamChangeLogsRepo');
const journeyGraphCatalogRepo = require('../../repos/firestore/journeyGraphCatalogRepo');
const journeyPolicyRepo = require('../../repos/firestore/journeyPolicyRepo');
const opsConfigRepo = require('../../repos/firestore/opsConfigRepo');
const { resolveEffectiveJourneyParams } = require('./resolveEffectiveJourneyParams');

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

async function persistEffectiveConfig(effective, actor, deps) {
  const payload = effective && typeof effective === 'object' ? effective : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const catalogRepo = resolvedDeps.journeyGraphCatalogRepo || journeyGraphCatalogRepo;
  const policyRepo = resolvedDeps.journeyPolicyRepo || journeyPolicyRepo;
  const llmRepo = resolvedDeps.opsConfigRepo || opsConfigRepo;

  const [savedGraph, savedJourneyPolicy, savedLlmPolicy] = await Promise.all([
    catalogRepo.setJourneyGraphCatalog(payload.graph || {}, actor),
    policyRepo.setJourneyPolicy(payload.journeyPolicy || {}, actor),
    llmRepo.setLlmPolicy(payload.llmPolicy || {}, actor)
  ]);

  return {
    graph: savedGraph,
    journeyPolicy: savedJourneyPolicy,
    llmPolicy: savedLlmPolicy
  };
}

async function applyJourneyParamVersion(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const versionsRepo = resolvedDeps.journeyParamVersionsRepo || journeyParamVersionsRepo;
  const runtimeRepo = resolvedDeps.journeyParamRuntimeRepo || journeyParamRuntimeRepo;
  const changeLogsRepo = resolvedDeps.journeyParamChangeLogsRepo || journeyParamChangeLogsRepo;

  const versionId = normalizeText(payload.versionId, '');
  if (!versionId) throw new Error('versionId required');
  const actor = normalizeText(payload.actor, 'unknown') || 'unknown';
  const traceId = normalizeText(payload.traceId, null);
  const requestId = normalizeText(payload.requestId, null);

  const version = await versionsRepo.getJourneyParamVersion(versionId);
  if (!version) throw new Error('journey_param_version_not_found');

  const action = normalizeText(payload.action, 'apply');
  if (action !== 'apply') throw new Error('unsupported_action');

  if (!['dry_run_passed', 'validated', 'applied'].includes(version.state)) {
    throw new Error('journey_param_state_not_applicable');
  }

  const runtime = await runtimeRepo.getJourneyParamRuntime().catch(() => null);
  const previousAppliedVersionId = runtime && typeof runtime.activeVersionId === 'string' && runtime.activeVersionId.trim()
    ? runtime.activeVersionId.trim()
    : null;

  const resolved = await resolveEffectiveJourneyParams({
    versionId,
    lineUserId: payload.lineUserId || null
  }, resolvedDeps);

  const savedConfig = await persistEffectiveConfig(resolved.effective, actor, resolvedDeps);
  const nextRuntime = await runtimeRepo.patchJourneyParamRuntime({
    enabled: true,
    activeVersionId: versionId,
    previousAppliedVersionId,
    canary: runtime && runtime.canary && runtime.canary.versionId === versionId
      ? Object.assign({}, runtime.canary, { enabled: false })
      : (runtime && runtime.canary ? runtime.canary : undefined)
  }, actor);

  const appliedMeta = {
    actor,
    traceId,
    requestId,
    appliedAt: new Date().toISOString()
  };

  const updatedVersion = await versionsRepo.patchJourneyParamVersion(versionId, {
    state: 'applied',
    previousAppliedVersionId,
    appliedMeta
  }, actor, {
    skipStateTransitionCheck: version.state === 'applied'
  });

  const summary = {
    action: 'apply',
    stateFrom: version.state,
    stateTo: 'applied',
    versionId,
    impactedUsers: 0,
    additionalNotifications: 0,
    disabledNodes: 0,
    deadlineBreachForecast: 0,
    dryRunHash: updatedVersion && updatedVersion.dryRun ? updatedVersion.dryRun.hash || null : null
  };

  await changeLogsRepo.appendJourneyParamChangeLog({
    actor,
    traceId,
    requestId,
    versionId,
    action: 'apply',
    summary,
    before: {
      runtime,
      version
    },
    after: {
      runtime: nextRuntime,
      version: updatedVersion
    },
    createdAt: new Date().toISOString()
  }).catch(() => null);

  return {
    ok: true,
    action: 'apply',
    version: updatedVersion,
    runtime: nextRuntime,
    savedConfig,
    summary
  };
}

async function rollbackJourneyParamVersion(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const versionsRepo = resolvedDeps.journeyParamVersionsRepo || journeyParamVersionsRepo;
  const runtimeRepo = resolvedDeps.journeyParamRuntimeRepo || journeyParamRuntimeRepo;
  const changeLogsRepo = resolvedDeps.journeyParamChangeLogsRepo || journeyParamChangeLogsRepo;

  const actor = normalizeText(payload.actor, 'unknown') || 'unknown';
  const traceId = normalizeText(payload.traceId, null);
  const requestId = normalizeText(payload.requestId, null);
  const runtime = await runtimeRepo.getJourneyParamRuntime();

  const currentVersionId = normalizeText(payload.versionId, runtime && runtime.activeVersionId ? runtime.activeVersionId : '');
  if (!currentVersionId) throw new Error('active_version_not_found');
  const rollbackToVersionId = normalizeText(
    payload.rollbackToVersionId,
    runtime && runtime.previousAppliedVersionId ? runtime.previousAppliedVersionId : ''
  );
  if (!rollbackToVersionId) throw new Error('rollback_target_not_found');

  const currentVersion = await versionsRepo.getJourneyParamVersion(currentVersionId);
  const targetVersion = await versionsRepo.getJourneyParamVersion(rollbackToVersionId);
  if (!targetVersion) throw new Error('rollback_target_not_found');

  const resolved = await resolveEffectiveJourneyParams({
    versionId: rollbackToVersionId,
    lineUserId: payload.lineUserId || null
  }, resolvedDeps);

  const savedConfig = await persistEffectiveConfig(resolved.effective, actor, resolvedDeps);

  const nextRuntime = await runtimeRepo.patchJourneyParamRuntime({
    enabled: true,
    activeVersionId: rollbackToVersionId,
    previousAppliedVersionId: currentVersionId
  }, actor);

  let rolledBackVersion = currentVersion;
  if (currentVersion) {
    rolledBackVersion = await versionsRepo.patchJourneyParamVersion(currentVersion.versionId, {
      state: 'rolled_back',
      appliedMeta: Object.assign({}, currentVersion.appliedMeta || {}, {
        actor,
        traceId,
        requestId,
        rollbackAt: new Date().toISOString()
      })
    }, actor, {
      skipStateTransitionCheck: currentVersion.state === 'rolled_back'
    }).catch(() => currentVersion);
  }

  const reappliedTarget = await versionsRepo.patchJourneyParamVersion(targetVersion.versionId, {
    state: 'applied',
    previousAppliedVersionId: currentVersionId,
    appliedMeta: {
      actor,
      traceId,
      requestId,
      appliedAt: new Date().toISOString()
    }
  }, actor, {
    skipStateTransitionCheck: targetVersion.state === 'applied'
  }).catch(() => targetVersion);

  const summary = {
    action: 'rollback',
    stateFrom: currentVersion ? currentVersion.state : null,
    stateTo: 'rolled_back',
    versionId: currentVersionId,
    impactedUsers: 0,
    additionalNotifications: 0,
    disabledNodes: 0,
    deadlineBreachForecast: 0,
    dryRunHash: currentVersion && currentVersion.dryRun ? currentVersion.dryRun.hash || null : null
  };

  await changeLogsRepo.appendJourneyParamChangeLog({
    actor,
    traceId,
    requestId,
    versionId: currentVersionId,
    action: 'rollback',
    summary,
    before: {
      runtime,
      currentVersion,
      targetVersion
    },
    after: {
      runtime: nextRuntime,
      currentVersion: rolledBackVersion,
      targetVersion: reappliedTarget
    },
    createdAt: new Date().toISOString()
  }).catch(() => null);

  return {
    ok: true,
    action: 'rollback',
    rolledBackVersion,
    targetVersion: reappliedTarget,
    runtime: nextRuntime,
    savedConfig,
    summary
  };
}

module.exports = {
  applyJourneyParamVersion,
  rollbackJourneyParamVersion
};
