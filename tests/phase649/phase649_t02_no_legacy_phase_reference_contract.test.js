'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = process.cwd();
const TARGET_DIRS = ['tests', 'scripts', 'src', 'docs', '.github'];
const SKIP_DIRS = new Set(['.git', '.worktrees', 'node_modules']);
const SKIP_FILE_RE = /^docs\/PHASE[A-Z0-9_-]*\.md$/;
const LEGACY_REF_RE = /docs\/PHASE[A-Z0-9_-]*\.md/g;
const ALLOWLIST_FILES = new Set([
  'docs/REPO_AUDIT_INPUTS/repo_map_ui.json'
]);

function walk(relDir, out) {
  const start = path.join(ROOT, relDir);
  if (!fs.existsSync(start)) return;
  const stack = [start];
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
    out.push(path.relative(ROOT, current).replace(/\\/g, '/'));
  }
}

test('phase649: legacy phase doc references are converged to archive paths', () => {
  const files = [];
  TARGET_DIRS.forEach((dir) => walk(dir, files));
  const findings = [];
  for (const relPath of files.sort()) {
    if (SKIP_FILE_RE.test(relPath)) continue;
    if (relPath === 'docs/PHASE_PATH_MAP.json') continue;
    if (relPath === 'docs/REPO_AUDIT_INPUTS/phase_compression_baseline.json') continue;
    if (ALLOWLIST_FILES.has(relPath)) continue;
    const text = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    const matches = text.match(LEGACY_REF_RE) || [];
    for (const hit of matches) {
      findings.push(`${relPath}:${hit}`);
      if (findings.length >= 20) break;
    }
    if (findings.length >= 20) break;
  }
  assert.deepStrictEqual(findings, []);
});
