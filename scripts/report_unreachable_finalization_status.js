'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const INDEX_FILE = path.join(SRC_DIR, 'index.js');
const CLASSIFICATION_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'unreachable_classification.json');
const REQUIRED_FILES = Object.freeze([
  'src/repos/firestore/indexFallbackPolicy.js',
  'src/shared/phaseDocPathResolver.js'
]);

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function toRepoRelative(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

function uniqSorted(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function listJsFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        return;
      }
      if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
    });
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function resolveRequire(fromFile, requestPath) {
  if (!requestPath || typeof requestPath !== 'string' || !requestPath.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), requestPath);
  const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function computeUnreachableFromIndex() {
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const reachable = new Set();
  const queue = [INDEX_FILE];

  while (queue.length) {
    const filePath = queue.pop();
    if (!filePath || reachable.has(filePath)) continue;
    reachable.add(filePath);
    const source = fs.readFileSync(filePath, 'utf8');
    let match = requireRe.exec(source);
    while (match) {
      const resolved = resolveRequire(filePath, match[1]);
      if (resolved && resolved.startsWith(SRC_DIR) && !reachable.has(resolved)) queue.push(resolved);
      match = requireRe.exec(source);
    }
  }

  return listJsFiles(SRC_DIR)
    .filter((filePath) => !reachable.has(filePath))
    .map((filePath) => toRepoRelative(filePath))
    .sort((a, b) => a.localeCompare(b));
}

function recommendationOf(disposition) {
  if (disposition === 'future_deletion_candidate') return 'frozen_keep_until_ssot_signoff_then_delete';
  if (disposition === 'keep_as_build_helper') return 'keep_as_build_time_helper_with_runtime_non_reachable_guard';
  return 'manual_review_required';
}

function run() {
  const payload = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const items = Array.isArray(payload.items) ? payload.items : [];
  const unreachable = computeUnreachableFromIndex();
  const unreachableSet = new Set(unreachable);
  const byFile = new Map(items.map((row) => [String((row && row.file) || ''), row]));

  const classified = items.map((row) => {
    const file = String((row && row.file) || '').trim();
    return {
      file,
      status: row && row.status ? String(row.status) : null,
      reachability: row && row.reachability ? String(row.reachability) : null,
      disposition: row && row.disposition ? String(row.disposition) : null,
      recommendation: recommendationOf(row && row.disposition ? String(row.disposition) : ''),
      runtimeDetectedByStaticGraph: unreachableSet.has(file),
      ssot_refs: uniqSorted(row && row.ssot_refs)
    };
  });

  const missingClassification = unreachable.filter((file) => !byFile.has(file));
  const staleClassification = classified.filter((row) => !unreachableSet.has(row.file)).map((row) => row.file);

  const statusCount = {};
  const dispositionCount = {};
  classified.forEach((row) => {
    const status = row.status || 'unknown';
    const disposition = row.disposition || 'unknown';
    statusCount[status] = Number(statusCount[status] || 0) + 1;
    dispositionCount[disposition] = Number(dispositionCount[disposition] || 0) + 1;
  });

  const requiredTargets = REQUIRED_FILES.map((file) => {
    const row = byFile.get(file) || null;
    return {
      file,
      isRuntimeUnreachable: unreachableSet.has(file),
      classified: Boolean(row),
      status: row && row.status ? row.status : null,
      disposition: row && row.disposition ? row.disposition : null,
      recommendation: recommendationOf(row && row.disposition ? row.disposition : ''),
      ssot_refs: row && Array.isArray(row.ssot_refs) ? uniqSorted(row.ssot_refs) : []
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      index: 'src/index.js',
      classification: 'docs/REPO_AUDIT_INPUTS/unreachable_classification.json'
    },
    summary: {
      currentUnreachableCount: unreachable.length,
      classifiedCount: classified.length,
      missingClassificationCount: missingClassification.length,
      staleClassificationCount: staleClassification.length,
      statusCount,
      dispositionCount
    },
    requiredTargets,
    missingClassification,
    staleClassification,
    classified
  };

  process.stdout.write('[unreachable-finalization-status] report\n');
  process.stdout.write(JSON.stringify(report, null, 2));
  process.stdout.write('\n');
}

run();
