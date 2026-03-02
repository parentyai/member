'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_MODEL_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'data_model_map.json');
const DATA_LIFECYCLE_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'data_lifecycle.json');
const ALLOWLIST_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'collection_drift_allowlist.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function uniqSorted(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function computeDrift() {
  const dataModel = readJson(DATA_MODEL_PATH);
  const dataLifecycle = readJson(DATA_LIFECYCLE_PATH);

  const modelCollections = uniqSorted((dataModel.collections || []).map((row) => row && row.collection));
  const lifecycleCollections = uniqSorted((dataLifecycle || []).map((row) => row && row.collection));

  const modelSet = new Set(modelCollections);
  const lifecycleSet = new Set(lifecycleCollections);

  const dataModelOnly = modelCollections.filter((name) => !lifecycleSet.has(name));
  const dataLifecycleOnly = lifecycleCollections.filter((name) => !modelSet.has(name));

  return {
    dataModelOnly,
    dataLifecycleOnly
  };
}

function diffSet(current, baseline) {
  const currentSet = new Set(current || []);
  const baselineSet = new Set(baseline || []);
  return {
    added: Array.from(currentSet).filter((item) => !baselineSet.has(item)).sort(),
    removed: Array.from(baselineSet).filter((item) => !currentSet.has(item)).sort()
  };
}

function formatList(label, rows) {
  const values = Array.isArray(rows) ? rows : [];
  if (!values.length) return `${label}: none`;
  return `${label}:\n - ${values.join('\n - ')}`;
}

function run() {
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    process.stderr.write(`collection drift allowlist missing: ${path.relative(ROOT, ALLOWLIST_PATH)}\n`);
    process.exit(1);
  }

  const allowlist = readJson(ALLOWLIST_PATH);
  const baseline = allowlist && typeof allowlist === 'object' ? allowlist.allowlist || {} : {};
  const baselineModelOnly = uniqSorted(baseline.data_model_only || []);
  const baselineLifecycleOnly = uniqSorted(baseline.data_lifecycle_only || []);

  const current = computeDrift();
  const currentModelOnly = uniqSorted(current.dataModelOnly);
  const currentLifecycleOnly = uniqSorted(current.dataLifecycleOnly);

  const modelDelta = diffSet(currentModelOnly, baselineModelOnly);
  const lifecycleDelta = diffSet(currentLifecycleOnly, baselineLifecycleOnly);

  const hasDelta = modelDelta.added.length
    || modelDelta.removed.length
    || lifecycleDelta.added.length
    || lifecycleDelta.removed.length;

  process.stdout.write(`collection_drift current data_model_only=${currentModelOnly.length} data_lifecycle_only=${currentLifecycleOnly.length}\n`);
  process.stdout.write(formatList('data_model_only', currentModelOnly) + '\n');
  process.stdout.write(formatList('data_lifecycle_only', currentLifecycleOnly) + '\n');

  if (hasDelta) {
    process.stderr.write('collection drift baseline mismatch detected\n');
    process.stderr.write(formatList('data_model_only added', modelDelta.added) + '\n');
    process.stderr.write(formatList('data_model_only removed', modelDelta.removed) + '\n');
    process.stderr.write(formatList('data_lifecycle_only added', lifecycleDelta.added) + '\n');
    process.stderr.write(formatList('data_lifecycle_only removed', lifecycleDelta.removed) + '\n');
    process.stderr.write(`update allowlist with SSOT rationale: ${path.relative(ROOT, ALLOWLIST_PATH)}\n`);
    process.exit(1);
  }

  process.stdout.write('collection drift matches SSOT allowlist\n');
}

run();
