'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const README_PATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'README.md');
const RUNBOOK_PATH = path.join(ROOT, 'docs', 'RUNBOOK_LINE_DESKTOP_PATROL.md');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const SCRIPT = path.join(ROOT, 'tools', 'line_desktop_patrol', 'scaffold_operator_bundle.js');

function assertSequence(text) {
  const sequence = [
    'line-desktop-patrol:doctor',
    'line-desktop-patrol:open-target',
    'line-desktop-patrol:execute-once',
    'line-desktop-patrol:loop-execute',
    'line-desktop-patrol:acceptance-gate',
  ];
  let previousIndex = -1;
  for (const token of sequence) {
    const currentIndex = text.indexOf(token);
    assert.notEqual(currentIndex, -1, `missing ${token}`);
    assert.ok(currentIndex > previousIndex, `${token} must appear after the previous safe-sequence step`);
    previousIndex = currentIndex;
  }
}

test('phase906: repo docs and generated operator README preserve the safe execute sequence and demote send to debug-only', (t) => {
  const bundleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase906-bundle-'));
  t.after(() => fs.rmSync(bundleRoot, { recursive: true, force: true }));

  execFileSync('node', [
    SCRIPT,
    '--bundle-root', bundleRoot,
    '--target-chat-title', 'メンバー',
    '--target-alias', 'member-self-test',
    '--force',
  ], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  const readme = fs.readFileSync(README_PATH, 'utf8');
  const runbook = fs.readFileSync(RUNBOOK_PATH, 'utf8');
  const generatedReadme = fs.readFileSync(path.join(bundleRoot, 'README.md'), 'utf8');

  assertSequence(readme);
  assertSequence(runbook);
  assertSequence(generatedReadme);

  assert.match(readme, /## Debug commands/);
  assert.match(readme, /open_target_mismatch_stop/);
  assert.match(runbook, /open_target_mismatch_stop/);
  assert.match(generatedReadme, /open_target_ready/);
  assert.match(generatedReadme, /open_target_mismatch_stop/);
  assert.match(generatedReadme, /generic LINE shell only/);
  assert.match(generatedReadme, /debug-only/);
  assert.match(generatedReadme, /メンバー/);
});

test('phase906: package exposes phase903-phase906 scripts for the new contract suites', () => {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  assert.equal(packageJson.scripts['test:phase903'], 'node --test tests/phase903/*.test.js');
  assert.equal(packageJson.scripts['test:phase904'], 'node --test tests/phase904/*.test.js');
  assert.equal(packageJson.scripts['test:phase905'], 'node --test tests/phase905/*.test.js');
  assert.equal(packageJson.scripts['test:phase906'], 'node --test tests/phase906/*.test.js');
});
