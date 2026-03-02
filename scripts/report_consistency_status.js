'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(...parts) {
  const filePath = path.join(ROOT, ...parts);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function uniqSorted(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function computeCollectionDrift() {
  const dataModel = readJson('docs', 'REPO_AUDIT_INPUTS', 'data_model_map.json');
  const dataLifecycle = readJson('docs', 'REPO_AUDIT_INPUTS', 'data_lifecycle.json');
  const allowlist = readJson('docs', 'REPO_AUDIT_INPUTS', 'collection_drift_allowlist.json');

  const modelCollections = uniqSorted((dataModel.collections || []).map((row) => row && row.collection));
  const lifecycleCollections = uniqSorted((dataLifecycle || []).map((row) => row && row.collection));
  const modelSet = new Set(modelCollections);
  const lifecycleSet = new Set(lifecycleCollections);

  const currentModelOnly = modelCollections.filter((name) => !lifecycleSet.has(name));
  const currentLifecycleOnly = lifecycleCollections.filter((name) => !modelSet.has(name));

  const baseline = allowlist && allowlist.allowlist ? allowlist.allowlist : {};
  const baseModelOnly = uniqSorted(baseline.data_model_only || []);
  const baseLifecycleOnly = uniqSorted(baseline.data_lifecycle_only || []);

  const modelAdded = currentModelOnly.filter((name) => !baseModelOnly.includes(name));
  const lifecycleAdded = currentLifecycleOnly.filter((name) => !baseLifecycleOnly.includes(name));

  return {
    current: {
      dataModelOnly: currentModelOnly.length,
      dataLifecycleOnly: currentLifecycleOnly.length
    },
    baseline: {
      dataModelOnly: baseModelOnly.length,
      dataLifecycleOnly: baseLifecycleOnly.length
    },
    growth: {
      dataModelOnlyAdded: modelAdded.length,
      dataLifecycleOnlyAdded: lifecycleAdded.length
    }
  };
}

function computePhaseOriginStatus() {
  const phaseOrigin = readJson('docs', 'REPO_AUDIT_INPUTS', 'phase_origin_evidence.json');
  const required = Array.isArray(phaseOrigin.targets) ? phaseOrigin.targets : [];
  const unknown = required.filter((row) => !Number.isInteger(Number(row && row.phaseOrigin)) || Number(row.phaseOrigin) <= 0);
  return {
    requiredFeatures: required.length,
    unknownCount: unknown.length
  };
}

function computeUnreachableStatus() {
  const unreachable = readJson('docs', 'REPO_AUDIT_INPUTS', 'unreachable_classification.json');
  const rows = Array.isArray(unreachable.items) ? unreachable.items : [];
  return {
    classifiedCount: rows.length,
    frozenCount: rows.filter((row) => row && row.status === 'frozen').length,
    monitorCount: rows.filter((row) => row && row.status === 'monitor').length
  };
}

function computeScenarioStatus() {
  const designMeta = readJson('docs', 'REPO_AUDIT_INPUTS', 'design_ai_meta.json');
  const allowlist = readJson('docs', 'REPO_AUDIT_INPUTS', 'scenario_key_drift_allowlist.json');
  const drift = (designMeta && designMeta.naming_drift) || {};
  const baseline = (allowlist && allowlist.allowlist) || {};

  const currentScenario = uniqSorted(drift.scenario || []);
  const currentScenarioKey = uniqSorted(drift.scenarioKey || []);
  const baseScenario = uniqSorted(baseline.scenario || []);
  const baseScenarioKey = uniqSorted(baseline.scenarioKey || []);

  return {
    current: {
      scenario: currentScenario.length,
      scenarioKey: currentScenarioKey.length
    },
    baseline: {
      scenario: baseScenario.length,
      scenarioKey: baseScenarioKey.length
    },
    growth: {
      scenarioAdded: currentScenario.filter((row) => !baseScenario.includes(row)).length,
      scenarioKeyAdded: currentScenarioKey.filter((row) => !baseScenarioKey.includes(row)).length
    }
  };
}

function run() {
  const summary = {
    generatedAt: new Date().toISOString(),
    source: 'docs/REPO_AUDIT_INPUTS/*',
    collectionDrift: computeCollectionDrift(),
    phaseOrigin: computePhaseOriginStatus(),
    unreachable: computeUnreachableStatus(),
    scenarioKeyDrift: computeScenarioStatus()
  };

  process.stdout.write('[consistency-status] summary\n');
  process.stdout.write(JSON.stringify(summary, null, 2));
  process.stdout.write('\n');
}

run();
