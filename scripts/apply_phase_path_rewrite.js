'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(ROOT, 'docs', 'PHASE_PATH_MAP.json');
const TARGET_DIRS = ['tests', 'scripts', 'src', 'docs', '.github'];
const SKIP_DIRS = new Set(['.git', '.worktrees', 'node_modules']);
const SKIP_FILES = new Set([
  path.normalize('docs/PHASE_PATH_MAP.json'),
  path.normalize('docs/REPO_AUDIT_INPUTS/phase_compression_baseline.json')
]);
const ALLOWED_EXT = new Set(['.md', '.js', '.json', '.yml', '.yaml', '.sh', '.txt']);

function walkFiles(startRelPath, out) {
  const startAbsPath = path.join(ROOT, startRelPath);
  if (!fs.existsSync(startAbsPath)) return;
  const stack = [startAbsPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
        stack.push(path.join(current, entry.name));
      }
      continue;
    }
    const rel = path.relative(ROOT, current);
    if (SKIP_FILES.has(path.normalize(rel))) continue;
    if (!ALLOWED_EXT.has(path.extname(current))) continue;
    out.push(rel);
  }
}

function run() {
  if (!fs.existsSync(MAP_PATH)) {
    console.error(`missing map file: ${MAP_PATH}`);
    process.exit(1);
  }
  const mapPayload = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const entries = Array.isArray(mapPayload.entries) ? mapPayload.entries : [];
  const files = [];
  TARGET_DIRS.forEach((dir) => walkFiles(dir, files));
  files.sort();

  let changedFiles = 0;
  for (const relPath of files) {
    const absPath = path.join(ROOT, relPath);
    const before = fs.readFileSync(absPath, 'utf8');
    let after = before;
    for (const entry of entries) {
      if (!entry || !entry.legacyPath || !entry.archivePath) continue;
      after = after.split(entry.legacyPath).join(entry.archivePath);
    }
    if (after !== before) {
      fs.writeFileSync(absPath, after);
      changedFiles += 1;
    }
  }

  console.log(`phase path rewrite complete: files_changed=${changedFiles}`);
}

run();
