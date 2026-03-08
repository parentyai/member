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
const ALLOWED_STATUS = new Set(['frozen', 'monitor']);
const ALLOWED_REACHABILITY = new Set(['non_reachable_runtime', 'build_time_only']);
const ALLOWED_DISPOSITION = new Set(['future_deletion_candidate', 'keep_as_build_helper']);

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function toRepoRelative(absPath) {
  return toPosix(path.relative(ROOT, absPath));
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

function run() {
  if (!fs.existsSync(CLASSIFICATION_PATH)) {
    process.stderr.write(`unreachable classification missing: ${path.relative(ROOT, CLASSIFICATION_PATH)}\n`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const rows = Array.isArray(payload.items) ? payload.items : [];
  const byFile = new Map(rows.map((row) => [row && row.file, row]));
  const requiredSet = new Set(REQUIRED_FILES);

  const errors = [];
  const unreachable = computeUnreachableFromIndex();

  REQUIRED_FILES.forEach((file) => {
    if (!byFile.has(file)) errors.push(`required classification row missing: ${file}`);
  });

  unreachable.forEach((file) => {
    const row = byFile.get(file);
    if (!row) {
      errors.push(`unreachable file is not classified: ${file}`);
      return;
    }
    if (!ALLOWED_STATUS.has(String(row.status || ''))) {
      errors.push(`invalid status for ${file}: ${row && row.status}`);
    }
    if (!ALLOWED_REACHABILITY.has(String(row.reachability || ''))) {
      errors.push(`invalid reachability for ${file}: ${row && row.reachability}`);
    }
    if (!ALLOWED_DISPOSITION.has(String(row.disposition || ''))) {
      errors.push(`invalid disposition for ${file}: ${row && row.disposition}`);
    }
  });

  rows.forEach((row) => {
    const file = row && row.file ? String(row.file) : '';
    if (!file) {
      errors.push('classification row missing file');
      return;
    }
    if (!unreachable.includes(file) && !requiredSet.has(file)) {
      errors.push(`classified file is not currently unreachable: ${file}`);
    }
  });

  process.stdout.write(`unreachable_classification current_unreachable=${unreachable.length}\n`);
  unreachable.forEach((file) => process.stdout.write(` - ${file}\n`));

  if (errors.length) {
    errors.forEach((msg) => process.stderr.write(`${msg}\n`));
    process.exit(1);
  }

  process.stdout.write('unreachable classification matches static graph\n');
}

run();
