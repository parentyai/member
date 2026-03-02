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

function buildCollectionIndex(dataModelRows) {
  const index = new Map();
  (dataModelRows || []).forEach((row) => {
    const collection = row && row.collection ? String(row.collection).trim() : '';
    if (!collection) return;
    if (!index.has(collection)) {
      index.set(collection, {
        repos: new Set(),
        note: row && row.note ? String(row.note).trim() : null
      });
    }
    const entry = index.get(collection);
    (row && row.repos || []).forEach((repo) => {
      const value = String(repo || '').trim();
      if (value) entry.repos.add(value);
    });
  });
  return index;
}

function buildLifecycleIndex(dataLifecycleRows) {
  const index = new Map();
  (dataLifecycleRows || []).forEach((row) => {
    const collection = row && row.collection ? String(row.collection).trim() : '';
    if (!collection) return;
    index.set(collection, {
      retentionDays: row && Number.isFinite(Number(row.retentionDays)) ? Number(row.retentionDays) : null,
      policy: row && row.policy ? String(row.policy).trim() : null,
      note: row && row.note ? String(row.note).trim() : null
    });
  });
  return index;
}

function run() {
  const dataModelMap = readJson('docs', 'REPO_AUDIT_INPUTS', 'data_model_map.json');
  const dataLifecycle = readJson('docs', 'REPO_AUDIT_INPUTS', 'data_lifecycle.json');
  const allowlist = readJson('docs', 'REPO_AUDIT_INPUTS', 'collection_drift_allowlist.json');

  const modelRows = Array.isArray(dataModelMap.collections) ? dataModelMap.collections : [];
  const lifecycleRows = Array.isArray(dataLifecycle) ? dataLifecycle : [];
  const modelIndex = buildCollectionIndex(modelRows);
  const lifecycleIndex = buildLifecycleIndex(lifecycleRows);

  const modelCollections = uniqSorted(Array.from(modelIndex.keys()));
  const lifecycleCollections = uniqSorted(Array.from(lifecycleIndex.keys()));
  const modelSet = new Set(modelCollections);
  const lifecycleSet = new Set(lifecycleCollections);

  const dataModelOnly = modelCollections.filter((collection) => !lifecycleSet.has(collection));
  const dataLifecycleOnly = lifecycleCollections.filter((collection) => !modelSet.has(collection));

  const baseline = allowlist && allowlist.allowlist ? allowlist.allowlist : {};
  const baselineModelOnly = uniqSorted(baseline.data_model_only || []);
  const baselineLifecycleOnly = uniqSorted(baseline.data_lifecycle_only || []);

  const summary = {
    generatedAt: new Date().toISOString(),
    counts: {
      dataModelOnly: dataModelOnly.length,
      dataLifecycleOnly: dataLifecycleOnly.length
    },
    growth: {
      dataModelOnlyAdded: dataModelOnly.filter((collection) => !baselineModelOnly.includes(collection)).length,
      dataLifecycleOnlyAdded: dataLifecycleOnly.filter((collection) => !baselineLifecycleOnly.includes(collection)).length
    },
    details: {
      dataModelOnly: dataModelOnly.map((collection) => {
        const info = modelIndex.get(collection) || {};
        return {
          collection,
          repos: Array.from(info.repos || []).sort(),
          dataModelNote: info.note || null
        };
      }),
      dataLifecycleOnly: dataLifecycleOnly.map((collection) => {
        const info = lifecycleIndex.get(collection) || {};
        return {
          collection,
          policy: info.policy || null,
          retentionDays: info.retentionDays,
          dataLifecycleNote: info.note || null
        };
      })
    }
  };

  process.stdout.write('[collection-drift-details] report\n');
  process.stdout.write(JSON.stringify(summary, null, 2));
  process.stdout.write('\n');
}

run();
