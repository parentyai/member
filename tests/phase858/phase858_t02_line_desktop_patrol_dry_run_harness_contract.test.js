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
  const output = execFileSync('python3', ['-m', moduleName].concat(args || []), {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH }),
    encoding: 'utf8'
  });
  return JSON.parse(output);
}

test('phase858: dry-run harness writes a local trace without send side effects', () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'line-desktop-patrol-'));
  const result = runPythonModule('member_line_patrol.dry_run_harness', [
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

  assert.equal(result.ok, true);
  assert.equal(result.failureReason, 'dry_run_only_skip');
  assert.ok(fs.existsSync(result.tracePath), 'trace artifact must exist');

  const trace = JSON.parse(fs.readFileSync(result.tracePath, 'utf8'));
  assert.equal(trace.dry_run_applied, true);
  assert.equal(trace.failure_reason, 'dry_run_only_skip');
  assert.equal(trace.target_id, 'sample-self-test');
  assert.equal(trace.host_probe.line_bundle_id, 'jp.naver.line.mac');
  assert.ok(Array.isArray(trace.state_transitions));
  assert.ok(trace.state_transitions.some((item) => item.state === 'LOAD_POLICY'));
  assert.ok(trace.state_transitions.some((item) => item.state === 'SEND_OR_DRYRUN' && item.status === 'skipped'));
  assert.equal(trace.observation_status, 'opt_in_observation_disabled_pr9');
  assert.equal(trace.ax_tree_after, null);
});
