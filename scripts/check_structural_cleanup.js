'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const INDEX_FILE = path.join(SRC_DIR, 'index.js');

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script].concat(args || []), {
    cwd: ROOT,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const DELETED_LEGACY_ALIAS_FILES = Object.freeze([
  'src/repos/firestore/phase18StatsRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsReadRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsRepo.js',
  'src/repos/firestore/phase2ReadRepo.js',
  'src/repos/firestore/phase2ReportsRepo.js',
  'src/repos/firestore/phase2RunsRepo.js'
]);

const DELETED_FROZEN_FILES = Object.freeze([
  'src/repos/firestore/checklistsRepo.js',
  'src/repos/firestore/kpiSnapshotsRepo.js',
  'src/repos/firestore/redacMembershipLinksRepo.js',
  'src/repos/firestore/userChecklistsRepo.js',
  'src/routes/admin/killSwitch.js',
  'src/usecases/checklists/getChecklistForUser.js',
  'src/usecases/checklists/getChecklistWithStatus.js',
  'src/usecases/checklists/setChecklistItemDone.js',
  'src/usecases/checklists/toggleChecklistItem.js',
  'src/usecases/phase117/resolveAutomationTargets.js',
  'src/usecases/phase43/executeAutomationDecision.js',
  'src/usecases/phase48/listAutomationConfigs.js',
  'src/usecases/phaseLLM4/getFaqAnswer.js',
  'src/usecases/users/getMemberProfile.js',
  'src/usecases/users/setMemberNumber.js'
]);

const STATIC_UNREACHABLE_ALLOWLIST = Object.freeze([
  'src/repos/firestore/indexFallbackPolicy.js',
  'src/shared/phaseDocPathResolver.js'
]);

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
      if (entry.isFile() && full.endsWith('.js')) out.push(full);
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

  const allJs = listJsFiles(SRC_DIR);
  return allJs
    .filter((filePath) => !reachable.has(filePath))
    .map((filePath) => toRepoRelative(filePath))
    .sort((a, b) => a.localeCompare(b));
}

function assertStaticUnreachableAllowlist() {
  const unreachable = computeUnreachableFromIndex();
  const allowlistSet = new Set(STATIC_UNREACHABLE_ALLOWLIST);
  const unexpected = unreachable.filter((item) => !allowlistSet.has(item));
  if (unexpected.length) {
    process.stderr.write(`unexpected static unreachable files: ${unexpected.join(', ')}\n`);
    process.exit(1);
  }
  const missing = STATIC_UNREACHABLE_ALLOWLIST.filter((item) => !unreachable.includes(item));
  if (missing.length) {
    process.stderr.write(`unreachable allowlist stale (missing current unreachable): ${missing.join(', ')}\n`);
    process.exit(1);
  }
}

function assertMarker(file, marker) {
  const absolute = path.join(ROOT, file);
  const source = fs.readFileSync(absolute, 'utf8');
  if (!source.includes(marker)) {
    process.stderr.write(`cleanup marker missing: ${file} (${marker})\n`);
    process.exit(1);
  }
}

function assertDeleted(file) {
  const absolute = path.join(ROOT, file);
  if (fs.existsSync(absolute)) {
    process.stderr.write(`cleanup deletion candidate still exists: ${file}\n`);
    process.exit(1);
  }
}

runNode(path.join('scripts', 'generate_cleanup_reports.js'), ['--check']);
DELETED_LEGACY_ALIAS_FILES.forEach((file) => assertDeleted(file));
DELETED_FROZEN_FILES.forEach((file) => assertDeleted(file));
assertStaticUnreachableAllowlist();
