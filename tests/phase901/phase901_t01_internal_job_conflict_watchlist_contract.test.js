'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = process.cwd();

test('phase901: package script exposes internal job conflict watchlist helper', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(
    pkg.scripts['internal-jobs:conflict-watchlist'],
    'node scripts/report_internal_job_conflict_watchlist.js'
  );
});

test('phase901: conflict watchlist report covers known shared artifact hotspots', () => {
  const run = spawnSync(process.execPath, ['scripts/report_internal_job_conflict_watchlist.js'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const payload = JSON.parse(run.stdout);
  assert.equal(payload.watchlistVersion, 'internal_job_conflict_watchlist.v1');
  assert.equal(payload.scope, 'internal_job_shared_artifacts');
  assert.equal(payload.lookbackCommits, 120);

  const hotspots = payload.hotspots || [];
  const hotspotPaths = new Set(hotspots.map((entry) => entry.path));
  assert.ok(hotspotPaths.has('docs/REPO_AUDIT_INPUTS/audit_inputs_manifest.json'));
  assert.ok(hotspotPaths.has('docs/REPO_AUDIT_INPUTS/load_risk.json'));
  assert.ok(hotspotPaths.has('docs/REPO_AUDIT_INPUTS/missing_index_surface.json'));
  assert.ok(hotspotPaths.has('docs/REPO_AUDIT_INPUTS/supervisor_master.json'));
  assert.ok(hotspotPaths.has('docs/KILLSWITCH_DEPENDENCY_MAP.md'));
  assert.ok(hotspots.every((entry) => Number.isInteger(entry.recentCommitTouches) && entry.recentCommitTouches >= 0));

  const sequence = new Set(payload.recommendedSequence || []);
  assert.ok(sequence.has('npm run docs-artifacts:generate'));
  assert.ok(sequence.has('npm run audit-inputs:generate'));
  assert.ok(sequence.has('npm run catchup:drift-check'));
});

test('phase901: CI structural checklist points contributors at the watchlist helper', () => {
  const text = fs.readFileSync(path.join(ROOT, 'docs/CI_STRUCTURAL_CHECKLIST.md'), 'utf8');
  assert.match(text, /internal-jobs:conflict-watchlist/);
  assert.match(text, /audit_inputs_manifest\.json/);
  assert.match(text, /supervisor_master\.json/);
});
