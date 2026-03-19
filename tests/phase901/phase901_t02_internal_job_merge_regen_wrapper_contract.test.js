'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = process.cwd();

test('phase901: package script exposes internal job merge regen wrapper', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(
    pkg.scripts['internal-jobs:merge-regen'],
    'node scripts/run_internal_job_merge_regen.js'
  );
});

test('phase901: merge regen wrapper publishes deterministic ordered plan', () => {
  const run = spawnSync(process.execPath, ['scripts/run_internal_job_merge_regen.js', '--plan'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const payload = JSON.parse(run.stdout);
  assert.equal(payload.planVersion, 'internal_job_merge_regen.v1');
  assert.equal(payload.scope, 'internal_job_structural_artifacts');
  assert.match(payload.precondition, /merging origin\/main/);

  const stepIds = (payload.steps || []).map((entry) => entry.id);
  assert.deepEqual(stepIds, [
    'conflict-watchlist',
    'audit-core',
    'repo-map',
    'docs-artifacts',
    'load-risk',
    'missing-index-surface',
    'retention-risk',
    'structure-risk',
    'cleanup',
    'supervisor-master',
    'audit-inputs',
    'test-docs',
    'catchup-drift'
  ]);
});

test('phase901: CI structural checklist points contributors at merge regen wrapper', () => {
  const text = fs.readFileSync(path.join(ROOT, 'docs/CI_STRUCTURAL_CHECKLIST.md'), 'utf8');
  assert.match(text, /internal-jobs:merge-regen/);
  assert.match(text, /Run this after merging origin\/main/i);
});
