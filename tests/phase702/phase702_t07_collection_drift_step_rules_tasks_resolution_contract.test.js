'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

function uniqSorted(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function computeDataModelOnlyCollections() {
  const dataModelMap = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/data_model_map.json', 'utf8'));
  const dataLifecycle = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/data_lifecycle.json', 'utf8'));

  const modelCollections = uniqSorted((dataModelMap.collections || []).map((row) => row && row.collection));
  const lifecycleCollections = uniqSorted((dataLifecycle || []).map((row) => row && row.collection));
  const lifecycleSet = new Set(lifecycleCollections);
  return modelCollections.filter((name) => !lifecycleSet.has(name));
}

function computeDataLifecycleOnlyCollections() {
  const dataModelMap = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/data_model_map.json', 'utf8'));
  const dataLifecycle = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/data_lifecycle.json', 'utf8'));

  const modelCollections = uniqSorted((dataModelMap.collections || []).map((row) => row && row.collection));
  const lifecycleCollections = uniqSorted((dataLifecycle || []).map((row) => row && row.collection));
  const modelSet = new Set(modelCollections);
  return lifecycleCollections.filter((name) => !modelSet.has(name));
}

test('phase702: step_rules/tasks are covered in data_lifecycle and removed from data_model_only drift', () => {
  const dataModelOnly = computeDataModelOnlyCollections();
  assert.equal(dataModelOnly.includes('step_rules'), false, 'step_rules should not remain in data_model_only drift');
  assert.equal(dataModelOnly.includes('tasks'), false, 'tasks should not remain in data_model_only drift');
});

test('phase702: consistency status reflects current collection drift baseline', () => {
  const result = spawnSync(process.execPath, ['scripts/report_consistency_status.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'consistency status report failed');
  const out = result.stdout || '';
  const start = out.indexOf('{');
  const payload = start >= 0 ? JSON.parse(out.slice(start)) : null;
  assert.ok(payload && payload.collectionDrift && payload.collectionDrift.current, 'consistency payload missing');
  assert.equal(payload.collectionDrift.current.dataModelOnly, 3);
  assert.equal(payload.collectionDrift.current.dataLifecycleOnly, 0);
  assert.equal(payload.collectionDrift.baseline.dataModelOnly, 3);
  assert.equal(payload.collectionDrift.baseline.dataLifecycleOnly, 0);
});

test('phase702: lifecycle-only drift is fully resolved for queued collections', () => {
  const dataLifecycleOnly = computeDataLifecycleOnlyCollections();
  assert.equal(dataLifecycleOnly.length, 0, `expected no lifecycle-only drift: ${dataLifecycleOnly.join(', ')}`);
});
