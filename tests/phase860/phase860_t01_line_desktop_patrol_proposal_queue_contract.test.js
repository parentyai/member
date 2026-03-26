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

test('phase860: enqueue proposals writes local queue rows and Codex packets from desktop patrol artifacts', () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'line-desktop-patrol-phase860-'));
  const proposalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'line-desktop-patrol-phase860-queue-'));
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

  const enqueueResult = runPythonModule('member_line_patrol.enqueue_eval_proposals', [
    '--trace',
    dryRun.tracePath,
    '--planning-output',
    planningOutput,
    '--main-output',
    mainOutput,
    '--queue-root',
    proposalRoot
  ]);

  assert.equal(enqueueResult.ok, true);
  assert.ok(enqueueResult.queuedCount >= 1);
  assert.equal(enqueueResult.duplicateCount, 0);
  assert.ok(fs.existsSync(enqueueResult.queuePath));
  assert.ok(fs.existsSync(enqueueResult.linkagePath));
  assert.ok(Array.isArray(enqueueResult.packetPaths));
  assert.ok(enqueueResult.packetPaths.length >= 1);

  const queueRows = fs.readFileSync(enqueueResult.queuePath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.ok(queueRows.length >= 1);
  assert.equal(queueRows[0].requires_human_review, true);
  assert.ok(Array.isArray(queueRows[0].source_trace_ids));
  assert.ok(queueRows[0].source_trace_ids.includes(JSON.parse(fs.readFileSync(dryRun.tracePath, 'utf8')).run_id));
  assert.ok(['observation_gap', 'routing_gap', 'policy_gap', 'retrieval_gap', 'ui_drift', 'operator_followup'].includes(queueRows[0].root_cause_category));

  const packet = JSON.parse(fs.readFileSync(enqueueResult.packetPaths[0], 'utf8'));
  assert.equal(packet.contract_version, 'line_desktop_patrol_codex_packet_v1');
  assert.equal(packet.queue_entry.proposal_id, queueRows[0].proposal_id);
  assert.equal(fs.realpathSync(packet.trace_ref.trace_path), fs.realpathSync(dryRun.tracePath));
  assert.ok(typeof packet.codex_task_brief === 'string' && packet.codex_task_brief.length > 0);
});
