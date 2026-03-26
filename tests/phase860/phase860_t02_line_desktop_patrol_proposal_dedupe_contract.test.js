'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const PYTHONPATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'src');

function runPythonModule(moduleName, args) {
  return JSON.parse(execFileSync('python3', ['-m', moduleName].concat(args || []), {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH }),
    encoding: 'utf8'
  }));
}

test('phase860: enqueue proposals keeps queue append-only and skips duplicate proposal ids on replay', () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'line-desktop-patrol-phase860-replay-'));
  const proposalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'line-desktop-patrol-phase860-replay-queue-'));
  const dryRun = runPythonModule('member_line_patrol.dry_run_harness', [
    '--policy',
    path.join(ROOT, 'tools', 'line_desktop_patrol', 'config', 'policy.example.json'),
    '--scenario',
    path.join(ROOT, 'tools', 'line_desktop_patrol', 'scenarios', 'smoke_dry_run.example.json'),
    '--output-root',
    outputRoot,
    '--route-key',
    'line-desktop-patrol',
    '--allow-disabled-policy'
  ]);
  const mainOutput = path.join(outputRoot, 'desktop_patrol_eval.json');
  const planningOutput = path.join(outputRoot, 'desktop_patrol_eval_planning.json');
  execFileSync('node', [
    'tools/quality_patrol/run_desktop_patrol_eval.js',
    '--trace',
    dryRun.tracePath,
    '--output',
    mainOutput,
    '--planning-output',
    planningOutput
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  const first = runPythonModule('member_line_patrol.enqueue_eval_proposals', [
    '--trace',
    dryRun.tracePath,
    '--planning-output',
    planningOutput,
    '--main-output',
    mainOutput,
    '--queue-root',
    proposalRoot
  ]);
  const second = runPythonModule('member_line_patrol.enqueue_eval_proposals', [
    '--trace',
    dryRun.tracePath,
    '--planning-output',
    planningOutput,
    '--main-output',
    mainOutput,
    '--queue-root',
    proposalRoot
  ]);

  assert.ok(first.queuedCount >= 1);
  assert.equal(second.queuedCount, 0);
  assert.ok(second.duplicateCount >= 1);

  const queueRows = fs.readFileSync(first.queuePath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(queueRows.length, first.queuedCount);
});
