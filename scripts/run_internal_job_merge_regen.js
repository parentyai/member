'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

const STEPS = Object.freeze([
  {
    id: 'conflict-watchlist',
    label: 'internal-job conflict hotspots',
    command: process.execPath,
    args: [path.join('scripts', 'report_internal_job_conflict_watchlist.js')]
  },
  {
    id: 'audit-core',
    label: 'audit core maps',
    command: process.execPath,
    args: [path.join('scripts', 'generate_audit_core_maps.js')]
  },
  {
    id: 'repo-map',
    label: 'repo map',
    command: process.execPath,
    args: [path.join('scripts', 'generate_repo_map.js')]
  },
  {
    id: 'docs-artifacts',
    label: 'docs artifacts',
    command: process.execPath,
    args: [path.join('scripts', 'generate_docs_artifacts.js')]
  },
  {
    id: 'load-risk',
    label: 'load risk',
    command: 'npm',
    args: ['run', 'load-risk:generate']
  },
  {
    id: 'missing-index-surface',
    label: 'missing index surface',
    command: 'npm',
    args: ['run', 'missing-index-surface:generate']
  },
  {
    id: 'retention-risk',
    label: 'retention risk',
    command: 'npm',
    args: ['run', 'retention-risk:generate']
  },
  {
    id: 'structure-risk',
    label: 'structure risk',
    command: 'npm',
    args: ['run', 'structure-risk:generate']
  },
  {
    id: 'cleanup',
    label: 'cleanup reports',
    command: 'npm',
    args: ['run', 'cleanup:generate']
  },
  {
    id: 'supervisor-master',
    label: 'supervisor master',
    command: process.execPath,
    args: [path.join('scripts', 'generate_supervisor_master.js')]
  },
  {
    id: 'audit-inputs',
    label: 'audit inputs manifest',
    command: 'npm',
    args: ['run', 'audit-inputs:generate']
  },
  {
    id: 'test-docs',
    label: 'docs validation',
    command: 'npm',
    args: ['run', 'test:docs']
  },
  {
    id: 'catchup-drift',
    label: 'catchup drift check',
    command: 'npm',
    args: ['run', 'catchup:drift-check']
  }
]);

function toPlanStep(step, index) {
  return {
    index: index + 1,
    id: step.id,
    label: step.label,
    command: [step.command].concat(step.args).join(' ')
  };
}

function printPlan() {
  const payload = {
    planVersion: 'internal_job_merge_regen.v1',
    scope: 'internal_job_structural_artifacts',
    precondition: 'Run this after merging origin/main into the working branch.',
    steps: STEPS.map(toPlanStep)
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function runStep(step) {
  const result = spawnSync(step.command, step.args, {
    cwd: ROOT,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  if (process.argv.includes('--plan')) {
    printPlan();
    return;
  }

  STEPS.forEach(runStep);
}

main();
