'use strict';

const journeyGraphCatalogRepo = require('../../repos/firestore/journeyGraphCatalogRepo');
const journeyPolicyRepo = require('../../repos/firestore/journeyPolicyRepo');
const opsConfigRepo = require('../../repos/firestore/opsConfigRepo');
const journeyParamRuntimeRepo = require('../../repos/firestore/journeyParamRuntimeRepo');
const journeyParamVersionsRepo = require('../../repos/firestore/journeyParamVersionsRepo');

function resolveBooleanEnvFlag(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return fallback === true;
}

function clone(value, fallback) {
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return JSON.parse(JSON.stringify(base));
  return JSON.parse(JSON.stringify(value));
}

function isLineUserTargeted(lineUserId, canary) {
  if (!lineUserId || typeof lineUserId !== 'string') return false;
  const lineUserIds = canary && Array.isArray(canary.lineUserIds) ? canary.lineUserIds : [];
  return lineUserIds.includes(lineUserId.trim());
}

function resolveSelectedVersionId(params, runtime) {
  const payload = params && typeof params === 'object' ? params : {};
  const runtimeConfig = runtime && typeof runtime === 'object' ? runtime : {};
  const explicitVersionId = typeof payload.versionId === 'string' && payload.versionId.trim() ? payload.versionId.trim() : null;
  if (explicitVersionId) return { versionId: explicitVersionId, source: 'explicit' };

  const canaryEnabled = resolveBooleanEnvFlag('ENABLE_JOURNEY_PARAM_CANARY_V1', false)
    && runtimeConfig
    && runtimeConfig.canary
    && runtimeConfig.canary.enabled === true
    && typeof runtimeConfig.canary.versionId === 'string'
    && runtimeConfig.canary.versionId.trim();
  if (canaryEnabled && isLineUserTargeted(payload.lineUserId, runtimeConfig.canary)) {
    return { versionId: runtimeConfig.canary.versionId.trim(), source: 'canary' };
  }

  const activeVersionId = typeof runtimeConfig.activeVersionId === 'string' && runtimeConfig.activeVersionId.trim()
    ? runtimeConfig.activeVersionId.trim()
    : null;
  if (activeVersionId) return { versionId: activeVersionId, source: 'active' };
  return { versionId: null, source: 'fallback' };
}

function mergeLlmPolicy(basePolicy, patch, normalizer) {
  const base = basePolicy && typeof basePolicy === 'object' ? basePolicy : {};
  const inputPatch = patch && typeof patch === 'object' ? patch : {};
  const merged = Object.assign({}, base, inputPatch);
  if (!Object.prototype.hasOwnProperty.call(inputPatch, 'disclaimer_templates') && base.disclaimer_templates) {
    merged.disclaimer_templates = clone(base.disclaimer_templates, {});
  }
  if (!Object.prototype.hasOwnProperty.call(inputPatch, 'output_constraints') && base.output_constraints) {
    merged.output_constraints = clone(base.output_constraints, {});
  }
  const normalized = typeof normalizer === 'function' ? normalizer(merged) : merged;
  return normalized || base;
}

function mergeJourneyPolicy(basePolicy, patch, normalizer) {
  const base = basePolicy && typeof basePolicy === 'object' ? basePolicy : {};
  const inputPatch = patch && typeof patch === 'object' ? patch : {};
  const merged = Object.assign({}, base, inputPatch);
  const normalized = typeof normalizer === 'function' ? normalizer(merged) : merged;
  return normalized || base;
}

function mergeGraphCatalog(baseCatalog, patch, normalizer) {
  const base = baseCatalog && typeof baseCatalog === 'object' ? baseCatalog : {};
  const inputPatch = patch && typeof patch === 'object' ? patch : {};
  const merged = Object.assign({}, base, inputPatch);
  if (!Object.prototype.hasOwnProperty.call(inputPatch, 'nodes') && Array.isArray(base.nodes)) {
    merged.nodes = clone(base.nodes, []);
  }
  if (!Object.prototype.hasOwnProperty.call(inputPatch, 'edges') && Array.isArray(base.edges)) {
    merged.edges = clone(base.edges, []);
  }
  if (!Object.prototype.hasOwnProperty.call(inputPatch, 'ruleSet') && base.ruleSet) {
    merged.ruleSet = clone(base.ruleSet, {});
  }
  if (!Object.prototype.hasOwnProperty.call(inputPatch, 'planUnlocks') && base.planUnlocks) {
    merged.planUnlocks = clone(base.planUnlocks, {});
  }
  const normalized = typeof normalizer === 'function' ? normalizer(merged) : merged;
  return normalized || base;
}

async function resolveEffectiveJourneyParams(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const catalogRepo = resolvedDeps.journeyGraphCatalogRepo || journeyGraphCatalogRepo;
  const policyRepo = resolvedDeps.journeyPolicyRepo || journeyPolicyRepo;
  const llmRepo = resolvedDeps.opsConfigRepo || opsConfigRepo;
  const runtimeRepo = resolvedDeps.journeyParamRuntimeRepo || journeyParamRuntimeRepo;
  const versionsRepo = resolvedDeps.journeyParamVersionsRepo || journeyParamVersionsRepo;

  const [baseGraph, baseJourneyPolicy, baseLlmPolicy] = await Promise.all([
    catalogRepo.getJourneyGraphCatalog(),
    policyRepo.getJourneyPolicy(),
    llmRepo.getLlmPolicy()
  ]);

  const versioningEnabled = resolveBooleanEnvFlag('ENABLE_JOURNEY_PARAM_VERSIONING_V1', false);
  if (!versioningEnabled && !payload.versionId) {
    return {
      ok: true,
      source: 'fallback',
      selectedVersionId: null,
      runtime: null,
      version: null,
      effective: {
        graph: baseGraph,
        journeyPolicy: baseJourneyPolicy,
        llmPolicy: baseLlmPolicy,
        policyVersionId: null
      }
    };
  }

  const runtime = await runtimeRepo.getJourneyParamRuntime().catch(() => null);
  const selected = resolveSelectedVersionId(payload, runtime || {});
  if (!selected.versionId) {
    return {
      ok: true,
      source: selected.source,
      selectedVersionId: null,
      runtime,
      version: null,
      effective: {
        graph: baseGraph,
        journeyPolicy: baseJourneyPolicy,
        llmPolicy: baseLlmPolicy,
        policyVersionId: null
      }
    };
  }

  const version = await versionsRepo.getJourneyParamVersion(selected.versionId).catch(() => null);
  if (!version || !version.parameters || typeof version.parameters !== 'object') {
    return {
      ok: true,
      source: 'fallback_missing_version',
      selectedVersionId: selected.versionId,
      runtime,
      version: null,
      effective: {
        graph: baseGraph,
        journeyPolicy: baseJourneyPolicy,
        llmPolicy: baseLlmPolicy,
        policyVersionId: null
      }
    };
  }

  const graph = mergeGraphCatalog(
    baseGraph,
    version.parameters.graph,
    catalogRepo.normalizeJourneyGraphCatalog
  );
  const journeyPolicy = mergeJourneyPolicy(
    baseJourneyPolicy,
    version.parameters.journeyPolicy,
    policyRepo.normalizeJourneyPolicy
  );
  const llmPolicy = mergeLlmPolicy(
    baseLlmPolicy,
    version.parameters.llmPolicyPatch,
    llmRepo.normalizeLlmPolicy
  );

  return {
    ok: true,
    source: selected.source,
    selectedVersionId: selected.versionId,
    runtime,
    version,
    effective: {
      graph,
      journeyPolicy,
      llmPolicy: Object.assign({}, llmPolicy, {
        policy_version_id: version.versionId
      }),
      policyVersionId: version.versionId
    }
  };
}

module.exports = {
  resolveEffectiveJourneyParams
};
