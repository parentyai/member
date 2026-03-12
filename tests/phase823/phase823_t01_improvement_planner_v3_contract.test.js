'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const {
  buildPlan,
  buildPlanFromClusters
} = require('../../tools/generate_llm_improvement_plan');

function writeJson(filePath, payload) {
  const target = path.join(ROOT, filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
}

test('phase823: planner v3 mode builds backlog rows with PR/objective/files/tests/risk/rollback', () => {
  const plan = buildPlanFromClusters({
    clusters: [
      {
        category: 'knowledge',
        severity: 'high',
        signals: [{ signal: 'cityPackGroundingRate' }]
      },
      {
        category: 'telemetry',
        severity: 'medium',
        signals: [{ signal: 'traceJoinCompleteness' }]
      }
    ]
  }, { clustersPath: 'tmp/failure_clusters.json' });

  assert.equal(plan.planVersion, 'v3');
  assert.ok(Array.isArray(plan.backlog));
  assert.ok(plan.backlog.length >= 2);
  plan.backlog.forEach((row) => {
    assert.ok(row.PR);
    assert.ok(row.objective);
    assert.ok(Array.isArray(row.files));
    assert.ok(Array.isArray(row.tests));
    assert.ok(row.risk);
    assert.ok(row.rollback);
  });
});

test('phase823: planner legacy mode remains backward compatible', () => {
  const rows = buildPlan(
    { criticalSliceFailures: [{ sliceKey: 'trace_join_incomplete' }] },
    { missingMeasurements: ['cityPackGroundingRate'] }
  );
  assert.ok(Array.isArray(rows));
  assert.ok(rows.length >= 1);
});

test('phase823: planner CLI accepts --clusters mode', () => {
  writeJson('tmp/phase823_failure_clusters.json', {
    clusters: [
      {
        category: 'readiness',
        severity: 'high',
        signals: [{ signal: 'contradictionRate' }]
      }
    ]
  });
  const outPath = 'tmp/phase823_improvement_plan.json';
  const run = spawnSync('node', [
    'tools/generate_llm_improvement_plan.js',
    '--clusters',
    'tmp/phase823_failure_clusters.json',
    '--output',
    outPath
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, outPath), 'utf8'));
  assert.equal(payload.planVersion, 'v3');
  assert.ok(Array.isArray(payload.backlog));
  assert.ok(payload.backlog[0].PR);
});
