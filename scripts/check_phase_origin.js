'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FEATURE_MAP_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'feature_map.json');
const PHASE_ORIGIN_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'phase_origin_evidence.json');
const PHASE_PATH_MAP_PATH = path.join(ROOT, 'docs', 'PHASE_PATH_MAP.json');
const REQUIRED_FEATURES = Object.freeze(['taskNudgeJob', 'userTimeline']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toRepoPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function existsRepoPath(repoPath) {
  if (!repoPath) return false;
  return fs.existsSync(path.join(ROOT, repoPath));
}

function run() {
  if (!fs.existsSync(PHASE_ORIGIN_PATH)) {
    process.stderr.write(`phase origin evidence missing: ${path.relative(ROOT, PHASE_ORIGIN_PATH)}\n`);
    process.exit(1);
  }

  const featureMap = readJson(FEATURE_MAP_PATH);
  const phaseOrigin = readJson(PHASE_ORIGIN_PATH);
  const phasePathMap = readJson(PHASE_PATH_MAP_PATH);

  const featureNames = new Set((featureMap.features || []).map((row) => row && row.feature).filter(Boolean));
  const targets = new Map((phaseOrigin.targets || []).map((row) => [row && row.feature, row]));

  const mapPaths = new Set();
  (phasePathMap.entries || []).forEach((entry) => {
    if (entry && entry.archivePath) mapPaths.add(toRepoPath(entry.archivePath));
    if (entry && entry.legacyPath) mapPaths.add(toRepoPath(entry.legacyPath));
  });

  const errors = [];
  let unknownCount = 0;

  REQUIRED_FEATURES.forEach((feature) => {
    if (!featureNames.has(feature)) {
      errors.push(`feature_map missing target feature: ${feature}`);
      unknownCount += 1;
      return;
    }

    const record = targets.get(feature);
    if (!record) {
      errors.push(`phase origin record missing: ${feature}`);
      unknownCount += 1;
      return;
    }

    const phaseOriginValue = Number(record.phaseOrigin);
    if (!Number.isInteger(phaseOriginValue) || phaseOriginValue <= 0) {
      errors.push(`phaseOrigin invalid: ${feature}`);
      unknownCount += 1;
    }

    const evidence = record.evidence && typeof record.evidence === 'object' ? record.evidence : {};
    const tests = Array.isArray(evidence.tests) ? evidence.tests.map(toRepoPath).filter(Boolean) : [];
    if (!tests.length) {
      errors.push(`tests evidence missing: ${feature}`);
    }
    tests.forEach((testPath) => {
      if (!existsRepoPath(testPath)) errors.push(`tests evidence not found: ${feature} -> ${testPath}`);
    });

    const routes = Array.isArray(evidence.routes) ? evidence.routes.map(toRepoPath).filter(Boolean) : [];
    if (!routes.length) {
      errors.push(`route evidence missing: ${feature}`);
    }
    routes.forEach((routePath) => {
      if (!existsRepoPath(routePath)) errors.push(`route evidence not found: ${feature} -> ${routePath}`);
    });

    const phaseDocs = Array.isArray(evidence.phaseDocs) ? evidence.phaseDocs.map(toRepoPath).filter(Boolean) : [];
    if (!phaseDocs.length) {
      errors.push(`phase docs evidence missing: ${feature}`);
    }
    phaseDocs.forEach((docPath) => {
      if (!existsRepoPath(docPath)) {
        errors.push(`phase docs evidence not found: ${feature} -> ${docPath}`);
        return;
      }
      if (!mapPaths.has(docPath)) {
        errors.push(`phase docs not linked in PHASE_PATH_MAP: ${feature} -> ${docPath}`);
      }
    });
  });

  process.stdout.write(`phase_origin required_features=${REQUIRED_FEATURES.length} unknown_count=${unknownCount}\n`);

  if (errors.length) {
    errors.forEach((msg) => process.stderr.write(`${msg}\n`));
    process.exit(1);
  }

  process.stdout.write('phase origin evidence is complete for required targets\n');
}

run();
