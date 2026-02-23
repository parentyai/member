'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const TASKS = Object.freeze([
  {
    label: 'repo-map',
    script: path.join('scripts', 'generate_repo_map.js')
  },
  {
    label: 'load-risk',
    script: path.join('scripts', 'generate_load_risk.js')
  },
  {
    label: 'missing-index-surface',
    script: path.join('scripts', 'generate_missing_index_surface.js')
  },
  {
    label: 'retention-risk',
    script: path.join('scripts', 'generate_retention_risk.js')
  },
  {
    label: 'structure-risk',
    script: path.join('scripts', 'generate_structure_risk.js')
  },
  {
    label: 'cleanup',
    script: path.join('scripts', 'generate_cleanup_reports.js')
  },
  {
    label: 'supervisor-master',
    script: path.join('scripts', 'generate_supervisor_master.js')
  },
  {
    label: 'audit-inputs',
    script: path.join('scripts', 'generate_audit_inputs_manifest.js')
  }
]);

function runNodeScript(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath].concat(args || []), {
    cwd: ROOT,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function run() {
  const checkMode = process.argv.includes('--check');
  const modeArgs = checkMode ? ['--check'] : [];

  TASKS.forEach((task) => {
    runNodeScript(task.script, modeArgs);
  });

  if (checkMode) {
    runNodeScript(path.join('scripts', 'check_structural_cleanup.js'), []);
  }
}

run();
