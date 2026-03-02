'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));
}

function uniqSorted(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function intersects(a, b) {
  if (!a.length || !b.length) return false;
  const setB = new Set(b);
  return a.some((item) => setB.has(item));
}

function repoNameFromEvidenceEntry(entry) {
  const text = String(entry || '').trim();
  const match = text.match(/src\/repos\/firestore\/([A-Za-z0-9_]+)\.js/);
  return match ? match[1] : null;
}

function scoreItem(item) {
  const base = item.type === 'data_model_only' ? 3 : 2;
  const featureScore = Math.min(item.features.length, 4);
  const repoScore = Math.min(item.repos.length, 3);
  const riskScore = item.fullscanRisk === 'HIGH' ? 3 : item.fullscanRisk === 'MEDIUM' ? 2 : 0;
  const indexScore = item.indexDependency === 'REQUIRED' ? 2 : 0;
  const policyScore = item.retention === 'INDEFINITE' ? 2 : 1;
  const score = base + featureScore + repoScore + riskScore + indexScore + policyScore;
  const priorityBand = score >= 10 ? 'P1_high' : score >= 7 ? 'P1_medium' : 'P1_low';
  return { score, priorityBand };
}

function run() {
  const dataModelMap = readJson('docs', 'REPO_AUDIT_INPUTS', 'data_model_map.json');
  const dataLifecycle = readJson('docs', 'REPO_AUDIT_INPUTS', 'data_lifecycle.json');
  const allowlist = readJson('docs', 'REPO_AUDIT_INPUTS', 'collection_drift_allowlist.json');
  const featureMap = readJson('docs', 'REPO_AUDIT_INPUTS', 'feature_map.json');

  const modelRows = Array.isArray(dataModelMap.collections) ? dataModelMap.collections : [];
  const lifecycleRows = Array.isArray(dataLifecycle) ? dataLifecycle : [];
  const features = Array.isArray(featureMap.features) ? featureMap.features : [];
  const baseline = allowlist && allowlist.allowlist ? allowlist.allowlist : {};

  const modelIndex = new Map();
  modelRows.forEach((row) => {
    const collection = String((row && row.collection) || '').trim();
    if (!collection) return;
    if (!modelIndex.has(collection)) modelIndex.set(collection, []);
    modelIndex.get(collection).push(row);
  });
  const lifecycleIndex = new Map();
  lifecycleRows.forEach((row) => {
    const collection = String((row && row.collection) || '').trim();
    if (!collection) return;
    lifecycleIndex.set(collection, row);
  });

  const modelCollections = uniqSorted(Array.from(modelIndex.keys()));
  const lifecycleCollections = uniqSorted(Array.from(lifecycleIndex.keys()));
  const modelSet = new Set(modelCollections);
  const lifecycleSet = new Set(lifecycleCollections);

  const dataModelOnly = modelCollections.filter((collection) => !lifecycleSet.has(collection));
  const dataLifecycleOnly = lifecycleCollections.filter((collection) => !modelSet.has(collection));

  const items = [];

  dataModelOnly.forEach((collection) => {
    const rows = modelIndex.get(collection) || [];
    const repos = uniqSorted(rows.flatMap((row) => row && row.repos || []));
    const featuresHit = uniqSorted(
      features
        .filter((feature) => intersects(uniqSorted(feature && feature.repos), repos))
        .map((feature) => feature && feature.feature)
    );
    const fullscanRisk = rows.some((row) => String(row && row.fullscan_risk || '').toUpperCase() === 'HIGH')
      ? 'HIGH'
      : rows.some((row) => String(row && row.fullscan_risk || '').toUpperCase() === 'MEDIUM')
        ? 'MEDIUM'
        : 'LOW';
    const indexDependency = rows.some((row) => String(row && row.index_dependency || '').toUpperCase() === 'REQUIRED')
      ? 'REQUIRED'
      : 'NOT_DETECTED';
    const item = {
      type: 'data_model_only',
      collection,
      repos,
      features: featuresHit,
      fullscanRisk,
      indexDependency,
      retention: 'UNDEFINED',
      recommendation: 'add_data_lifecycle_policy'
    };
    const scored = scoreItem(item);
    items.push({
      ...item,
      priorityScore: scored.score,
      priorityBand: scored.priorityBand
    });
  });

  dataLifecycleOnly.forEach((collection) => {
    const row = lifecycleIndex.get(collection) || {};
    const repos = uniqSorted((row.evidence || []).map(repoNameFromEvidenceEntry).filter(Boolean));
    const featuresHit = uniqSorted(
      features
        .filter((feature) => intersects(uniqSorted(feature && feature.repos), repos))
        .map((feature) => feature && feature.feature)
    );
    const item = {
      type: 'data_lifecycle_only',
      collection,
      repos,
      features: featuresHit,
      fullscanRisk: 'UNKNOWN',
      indexDependency: 'UNKNOWN',
      retention: String(row.retention || 'UNDEFINED'),
      recommendation: repos.length ? 'add_data_model_map_row' : 'verify_deprecate_or_relink'
    };
    const scored = scoreItem(item);
    items.push({
      ...item,
      priorityScore: scored.score,
      priorityBand: scored.priorityBand
    });
  });

  items.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return a.collection.localeCompare(b.collection);
  });

  const priorityBreakdown = {};
  const typeBreakdown = {};
  items.forEach((item) => {
    priorityBreakdown[item.priorityBand] = Number(priorityBreakdown[item.priorityBand] || 0) + 1;
    typeBreakdown[item.type] = Number(typeBreakdown[item.type] || 0) + 1;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      dataModelMap: 'docs/REPO_AUDIT_INPUTS/data_model_map.json',
      dataLifecycle: 'docs/REPO_AUDIT_INPUTS/data_lifecycle.json',
      allowlist: 'docs/REPO_AUDIT_INPUTS/collection_drift_allowlist.json',
      featureMap: 'docs/REPO_AUDIT_INPUTS/feature_map.json'
    },
    summary: {
      driftCount: items.length,
      dataModelOnlyCount: dataModelOnly.length,
      dataLifecycleOnlyCount: dataLifecycleOnly.length,
      baselineDataModelOnlyCount: uniqSorted(baseline.data_model_only || []).length,
      baselineDataLifecycleOnlyCount: uniqSorted(baseline.data_lifecycle_only || []).length,
      typeBreakdown,
      priorityBreakdown
    },
    topQueue: items.slice(0, 20),
    items
  };

  process.stdout.write('[collection-drift-remediation-queue] report\n');
  process.stdout.write(JSON.stringify(report, null, 2));
  process.stdout.write('\n');
}

run();
