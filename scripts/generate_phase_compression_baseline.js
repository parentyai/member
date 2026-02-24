'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'phase_compression_baseline.json');
const TARGET_DIRS = ['tests', 'scripts', 'src', 'docs', '.github'];
const SKIP_DIRS = new Set(['.git', '.worktrees', 'node_modules']);
const FILE_EXT = new Set(['.md', '.js', '.json', '.yml', '.yaml', '.sh', '.txt']);
const LEGACY_RE = /docs\/PHASE[A-Z0-9_-]*\.md/g;

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
    if (!FILE_EXT.has(path.extname(current))) continue;
    out.push(current);
  }
}

function countLegacyReferences() {
  const files = [];
  TARGET_DIRS.forEach((dir) => walkFiles(dir, files));
  let total = 0;
  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    const match = text.match(LEGACY_RE);
    total += match ? match.length : 0;
  }
  return total;
}

function countSsoIndexPhaseRows() {
  const ssotPath = path.join(ROOT, 'docs', 'SSOT_INDEX.md');
  if (!fs.existsSync(ssotPath)) return 0;
  const text = fs.readFileSync(ssotPath, 'utf8');
  return text.split('\n').filter((line) => line.startsWith('- `docs/PHASE')).length;
}

function run() {
  const payload = {
    version: 1,
    scope: ['tests', 'scripts', 'src', 'docs', '.github'],
    legacyPhaseReferenceCount: countLegacyReferences(),
    ssotIndexPhaseRowCount: countSsoIndexPhaseRows(),
    checks: {
      testDocsScript: 'npm run test:docs',
      docsArtifactsCheck: 'npm run docs-artifacts:check',
      fullTest: 'npm test'
    }
  };
  fs.writeFileSync(TARGET_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`generated: ${path.relative(ROOT, TARGET_PATH)}`);
}

run();
