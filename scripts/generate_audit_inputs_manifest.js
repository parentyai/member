'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS');
const OUTPUT_PATH = path.join(INPUT_DIR, 'audit_inputs_manifest.json');

const DIFF_DETECTION_RULES = Object.freeze([
  'If endpoint count changes, regenerate protection_matrix and impact_radius.',
  'If usecase/repo count changes, regenerate dependency_graph and design_ai_meta.',
  'If any JSON hash changes, require report refresh and PR note update.',
  'If new docs JSON is added under docs/REPO_AUDIT_INPUTS, include in manifest files list.'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function listInputFiles() {
  return fs.readdirSync(INPUT_DIR)
    .filter((name) => name.endsWith('.json'))
    .filter((name) => name !== 'audit_inputs_manifest.json')
    .sort()
    .map((name) => path.join(INPUT_DIR, name));
}

function buildSourceDigest(files) {
  const hash = crypto.createHash('sha256');
  files.forEach((filePath) => {
    hash.update(toPosix(path.relative(ROOT, filePath)));
    hash.update('\n');
    hash.update(fs.readFileSync(filePath));
    hash.update('\n');
  });
  return hash.digest('hex');
}

function readGitValue(command, fallback) {
  try {
    const value = childProcess.execSync(command, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString('utf8').trim();
    if (value) return value;
  } catch (_err) {
    // ignore: fallback below
  }
  return fallback;
}

function resolveBranchName() {
  const envBranch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || process.env.CI_COMMIT_REF_NAME;
  if (typeof envBranch === 'string' && envBranch.trim()) return envBranch.trim();
  return readGitValue('git rev-parse --abbrev-ref HEAD', 'NOT_AVAILABLE');
}

function resolveGitMetadata(files) {
  const sourceDigest = buildSourceDigest(files);
  const gitCommit = readGitValue('git rev-parse HEAD', sourceDigest.slice(0, 40));
  const generatedAt = readGitValue('git log -1 --format=%cI', 'NOT_AVAILABLE');
  const branch = resolveBranchName();
  return { sourceDigest, gitCommit, generatedAt, branch };
}

function buildCounts() {
  const protection = readJson(path.join(INPUT_DIR, 'protection_matrix.json'));
  const deps = readJson(path.join(INPUT_DIR, 'dependency_graph.json'));
  const dataModel = readJson(path.join(INPUT_DIR, 'data_model_map.json'));

  const endpointCount = Number.isFinite(Number(protection && protection.counts && protection.counts.endpoints))
    ? Number(protection.counts.endpoints)
    : (Array.isArray(protection && protection.protection_matrix) ? protection.protection_matrix.length : 0);

  return {
    endpoints: endpointCount,
    routes: Object.keys((deps && deps.route_to_usecase) || {}).length,
    usecases: Object.keys((deps && deps.usecase_to_repo) || {}).length,
    repos: Object.keys((deps && deps.repo_to_collection) || {}).length,
    collections: Array.isArray(dataModel && dataModel.collections) ? dataModel.collections.length : 0
  };
}

function buildManifest() {
  const files = listInputFiles();
  const gitMeta = resolveGitMetadata(files);
  const fileRows = files.map((filePath) => {
    const stat = fs.statSync(filePath);
    return {
      file: toPosix(path.relative(ROOT, filePath)),
      sha256: hashFile(filePath),
      bytes: stat.size
    };
  });

  return {
    generatedAt: gitMeta.generatedAt,
    gitCommit: gitMeta.gitCommit,
    branch: gitMeta.branch,
    sourceDigest: gitMeta.sourceDigest,
    counts: buildCounts(),
    files: fileRows,
    diff_detection_rules: Array.from(DIFF_DETECTION_RULES),
    previous_manifest: 'NONE',
    manifest_version: 2
  };
}

function run() {
  const checkMode = process.argv.includes('--check');
  const manifest = buildManifest();
  const next = `${JSON.stringify(manifest, null, 2)}\n`;

  if (checkMode) {
    const currentRaw = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : '';
    let currentJson = null;
    try {
      currentJson = currentRaw ? JSON.parse(currentRaw) : null;
    } catch (_err) {
      process.stderr.write('audit_inputs_manifest.json is invalid JSON. run: npm run audit-inputs:generate\n');
      process.exit(1);
    }
    if (!currentJson) {
      process.stderr.write('audit_inputs_manifest.json is stale. run: npm run audit-inputs:generate\n');
      process.exit(1);
    }
    const comparableCurrent = Object.assign({}, currentJson);
    const comparableNext = Object.assign({}, manifest);
    delete comparableCurrent.generatedAt;
    delete comparableCurrent.gitCommit;
    delete comparableCurrent.branch;
    delete comparableNext.generatedAt;
    delete comparableNext.gitCommit;
    delete comparableNext.branch;
    if (JSON.stringify(comparableCurrent) !== JSON.stringify(comparableNext)) {
      process.stderr.write('audit_inputs_manifest.json is stale. run: npm run audit-inputs:generate\n');
      process.exit(1);
    }
    process.stdout.write('audit_inputs_manifest.json is up to date\n');
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, next, 'utf8');
  process.stdout.write(`generated: ${toPosix(path.relative(ROOT, OUTPUT_PATH))}\n`);
}

run();
