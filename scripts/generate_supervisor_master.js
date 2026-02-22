'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'supervisor_master.json');

const REQUIRED = Object.freeze({
  ssot: {
    index: 'docs/SSOT_INDEX.md',
    ui_os: 'docs/SSOT_ADMIN_UI_OS.md',
    ui_dictionary: 'docs/ADMIN_UI_DICTIONARY_JA.md',
    data_model: 'docs/SSOT_ADMIN_UI_DATA_MODEL.md',
    service_phase: 'docs/SSOT_SERVICE_PHASES.md',
    notification_preset: 'docs/SSOT_NOTIFICATION_PRESETS.md',
    phase_preset_matrix: 'docs/SSOT_SERVICE_PHASE_X_PRESET_MATRIX.md'
  },
  audit_inputs: {
    manifest: 'docs/REPO_AUDIT_INPUTS/audit_inputs_manifest.json',
    dependency_graph: 'docs/REPO_AUDIT_INPUTS/dependency_graph.json',
    state_transitions: 'docs/REPO_AUDIT_INPUTS/state_transitions.json',
    data_model_map: 'docs/REPO_AUDIT_INPUTS/data_model_map.json',
    kill_switch_points: 'docs/REPO_AUDIT_INPUTS/kill_switch_points.json',
    protection_matrix: 'docs/REPO_AUDIT_INPUTS/protection_matrix.json',
    impact_radius: 'docs/REPO_AUDIT_INPUTS/impact_radius.json',
    load_risk: 'docs/REPO_AUDIT_INPUTS/load_risk.json'
  },
  guards: {
    index_route_guard: 'src/index.js'
  },
  ci: {
    workflows: [
      '.github/workflows/audit.yml',
      '.github/workflows/deploy.yml',
      '.github/workflows/deploy-webhook.yml',
      '.github/workflows/deploy-track.yml',
      '.github/workflows/stg-notification-e2e.yml'
    ],
    scripts: 'package.json'
  }
});

const RECOMMENDED = Object.freeze({
  data_map: 'docs/DATA_MAP.md',
  retention: 'docs/SSOT_RETENTION.md',
  retention_addendum: 'docs/SSOT_RETENTION_ADDENDUM.md',
  line_only_delta: 'docs/SSOT_LINE_ONLY_DELTA.md',
  kill_switch_dependency_map: 'docs/KILLSWITCH_DEPENDENCY_MAP.md',
  schema_templates_v: 'docs/SCHEMA_templates_v.md',
  schema_ops_segments: 'docs/SCHEMA_ops_segments.md',
  audit_report_latest: 'docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md'
});

const EXCLUDED_EXAMPLES = Object.freeze([
  'tests/**',
  'apps/admin/*.html',
  'docs/PHASE*_EXECUTION_LOG.md',
  'docs/PHASE*_PLAN.md',
  'docs/CI_EVIDENCE/**'
]);

const DIGEST_EXCLUDE = new Set([
  'docs/REPO_AUDIT_INPUTS/audit_inputs_manifest.json'
]);

function readGitValue(command, fallback) {
  try {
    const value = childProcess.execSync(command, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString('utf8').trim();
    if (value) return value;
  } catch (_err) {
    // ignore
  }
  return fallback;
}

function resolveBranchName() {
  const envBranch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || process.env.CI_COMMIT_REF_NAME;
  if (typeof envBranch === 'string' && envBranch.trim()) return envBranch.trim();
  return readGitValue('git rev-parse --abbrev-ref HEAD', 'NOT_AVAILABLE');
}

function collectPaths(value, out) {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectPaths(item, out));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectPaths(item, out));
  }
}

function validatePaths(paths) {
  const missing = [];
  paths.forEach((relPath) => {
    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) missing.push(relPath);
  });
  if (missing.length > 0) {
    const message = `Missing required files:\n${missing.map((p) => `- ${p}`).join('\n')}`;
    throw new Error(message);
  }
}

function buildSourceDigest(paths) {
  const hash = crypto.createHash('sha256');
  paths.forEach((relPath) => {
    if (DIGEST_EXCLUDE.has(relPath)) return;
    const absPath = path.join(ROOT, relPath);
    hash.update(relPath);
    hash.update('\n');
    hash.update(fs.readFileSync(absPath));
    hash.update('\n');
  });
  return hash.digest('hex');
}

function buildPayload() {
  const requiredPaths = [];
  const recommendedPaths = [];
  collectPaths(REQUIRED, requiredPaths);
  collectPaths(RECOMMENDED, recommendedPaths);
  const allPaths = Array.from(new Set(requiredPaths.concat(recommendedPaths))).sort();

  validatePaths(allPaths);

  return {
    generatedAt: readGitValue('git log -1 --format=%cI', new Date().toISOString()),
    gitCommit: readGitValue('git rev-parse HEAD', 'NOT_AVAILABLE'),
    branch: resolveBranchName(),
    sourceDigest: buildSourceDigest(allPaths),
    required: REQUIRED,
    recommended: RECOMMENDED,
    excluded_examples: EXCLUDED_EXAMPLES
  };
}

function stripVolatileFields(payload) {
  const clone = Object.assign({}, payload);
  delete clone.generatedAt;
  delete clone.gitCommit;
  delete clone.branch;
  return clone;
}

function run() {
  const checkMode = process.argv.includes('--check');
  const payload = buildPayload();
  const next = `${JSON.stringify(payload, null, 2)}\n`;

  if (checkMode) {
    if (!fs.existsSync(OUTPUT_PATH)) {
      process.stderr.write('supervisor_master.json is missing. run: node scripts/generate_supervisor_master.js\n');
      process.exit(1);
    }
    let current;
    try {
      current = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    } catch (_err) {
      process.stderr.write('supervisor_master.json is invalid JSON. run: node scripts/generate_supervisor_master.js\n');
      process.exit(1);
    }
    if (JSON.stringify(stripVolatileFields(current)) !== JSON.stringify(stripVolatileFields(payload))) {
      process.stderr.write('supervisor_master.json is stale. run: node scripts/generate_supervisor_master.js\n');
      process.exit(1);
    }
    process.stdout.write('supervisor_master.json is up to date\n');
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, next, 'utf8');
  process.stdout.write(`generated: ${path.relative(ROOT, OUTPUT_PATH).replace(/\\/g, '/')}\n`);
}

run();
