'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId } = require('./osContext');
const journeyPolicyRepo = require('../../repos/firestore/journeyPolicyRepo');
const journeyGraphCatalogRepo = require('../../repos/firestore/journeyGraphCatalogRepo');
const journeyParamRuntimeRepo = require('../../repos/firestore/journeyParamRuntimeRepo');
const richMenuPolicyRepo = require('../../repos/firestore/richMenuPolicyRepo');
const opsConfigRepo = require('../../repos/firestore/opsConfigRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const {
  isUxosPolicyReadonlyEnabled,
  isUxosEventsEnabled,
  isUxosNbaEnabled,
  isUxosFatigueWarnEnabled,
  isUxosEmergencyOverrideEnabled
} = require('../../domain/uxos/featureFlags');
const {
  isTaskEngineEnabled,
  isTaskNudgeEnabled,
  isJourneyAttentionBudgetEnabled
} = require('../../domain/tasks/featureFlags');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function buildFeatureFlagsSnapshot() {
  return {
    uxosEventsEnabled: isUxosEventsEnabled(),
    uxosNbaEnabled: isUxosNbaEnabled(),
    uxosFatigueWarnEnabled: isUxosFatigueWarnEnabled(),
    uxosEmergencyOverrideEnabled: isUxosEmergencyOverrideEnabled(),
    uxosPolicyReadonlyEnabled: isUxosPolicyReadonlyEnabled(),
    taskEngineEnabled: isTaskEngineEnabled(),
    taskNudgeEnabled: isTaskNudgeEnabled(),
    journeyAttentionBudgetEnabled: isJourneyAttentionBudgetEnabled()
  };
}

async function handleStatus(req, res, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const flags = buildFeatureFlagsSnapshot();
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const journeyPolicyRepoResolved = resolvedDeps.journeyPolicyRepo && typeof resolvedDeps.journeyPolicyRepo.getJourneyPolicy === 'function'
    ? resolvedDeps.journeyPolicyRepo
    : journeyPolicyRepo;
  const journeyGraphCatalogRepoResolved = resolvedDeps.journeyGraphCatalogRepo && typeof resolvedDeps.journeyGraphCatalogRepo.getJourneyGraphCatalog === 'function'
    ? resolvedDeps.journeyGraphCatalogRepo
    : journeyGraphCatalogRepo;
  const journeyParamRuntimeRepoResolved = resolvedDeps.journeyParamRuntimeRepo && typeof resolvedDeps.journeyParamRuntimeRepo.getJourneyParamRuntime === 'function'
    ? resolvedDeps.journeyParamRuntimeRepo
    : journeyParamRuntimeRepo;
  const richMenuPolicyRepoResolved = resolvedDeps.richMenuPolicyRepo && typeof resolvedDeps.richMenuPolicyRepo.getRichMenuPolicy === 'function'
    ? resolvedDeps.richMenuPolicyRepo
    : richMenuPolicyRepo;
  const opsConfigRepoResolved = resolvedDeps.opsConfigRepo && typeof resolvedDeps.opsConfigRepo.getLlmPolicy === 'function'
    ? resolvedDeps.opsConfigRepo
    : opsConfigRepo;
  const systemFlagsRepoResolved = resolvedDeps.systemFlagsRepo && typeof resolvedDeps.systemFlagsRepo.getLlmEnabled === 'function'
    ? resolvedDeps.systemFlagsRepo
    : systemFlagsRepo;

  if (!flags.uxosPolicyReadonlyEnabled) {
    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      enabled: false,
      reason: 'disabled_by_flag',
      flags
    });
    return;
  }

  try {
    const [
      journeyPolicy,
      journeyGraphCatalog,
      journeyParamRuntime,
      richMenuPolicy,
      llmPolicy,
      systemLlmEnabled
    ] = await Promise.all([
      journeyPolicyRepoResolved.getJourneyPolicy().catch(() => null),
      journeyGraphCatalogRepoResolved.getJourneyGraphCatalog().catch(() => null),
      journeyParamRuntimeRepoResolved.getJourneyParamRuntime().catch(() => null),
      richMenuPolicyRepoResolved.getRichMenuPolicy().catch(() => null),
      opsConfigRepoResolved.getLlmPolicy().catch(() => null),
      systemFlagsRepoResolved.getLlmEnabled().catch(() => false)
    ]);

    const snapshot = {
      flags,
      journey: {
        policyEnabled: Boolean(journeyPolicy && journeyPolicy.enabled === true),
        graphEnabled: Boolean(journeyGraphCatalog && journeyGraphCatalog.enabled === true),
        graphReactionBranchCount: Array.isArray(
          journeyGraphCatalog
          && journeyGraphCatalog.ruleSet
          && journeyGraphCatalog.ruleSet.reactionBranches
        )
          ? journeyGraphCatalog.ruleSet.reactionBranches.length
          : 0,
        activeParamVersionId: journeyParamRuntime && journeyParamRuntime.activeVersionId
          ? journeyParamRuntime.activeVersionId
          : null
      },
      notification: {
        fatigueWarnMode: flags.uxosFatigueWarnEnabled ? 'warn_only' : 'disabled',
        emergencyOverrideMode: flags.uxosEmergencyOverrideEnabled ? 'region_sent_bulletin' : 'disabled'
      },
      llm: {
        systemEnabled: Boolean(systemLlmEnabled),
        policyEnabled: Boolean(llmPolicy && llmPolicy.enabled === true),
        lawfulBasis: llmPolicy && llmPolicy.lawfulBasis ? llmPolicy.lawfulBasis : null,
        consentVerified: llmPolicy && llmPolicy.consentVerified === true
      },
      richMenu: {
        enabled: Boolean(richMenuPolicy && richMenuPolicy.enabled === true),
        updateEnabled: Boolean(richMenuPolicy && richMenuPolicy.updateEnabled === true)
      }
    };

    await appendAuditLog({
      actor,
      action: 'ux_policy.readonly.view',
      entityType: 'ux_policy',
      entityId: 'readonly',
      traceId,
      requestId,
      payloadSummary: {
        enabled: true,
        journeyPolicyEnabled: snapshot.journey.policyEnabled,
        journeyGraphEnabled: snapshot.journey.graphEnabled,
        reactionBranchCount: snapshot.journey.graphReactionBranchCount,
        richMenuEnabled: snapshot.richMenu.enabled,
        llmPolicyEnabled: snapshot.llm.policyEnabled
      }
    }).catch(() => null);

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      enabled: true,
      snapshot
    });
  } catch (_err) {
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId });
  }
}

module.exports = {
  handleStatus
};
