'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'tools', 'line_desktop_patrol', 'scaffold_operator_bundle.js');

test('phase877: scaffold_operator_bundle creates machine-local dry-run-only assets for a member-only target', (t) => {
  const bundleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase877-bundle-'));
  t.after(() => fs.rmSync(bundleRoot, { recursive: true, force: true }));

  const output = execFileSync('node', [
    SCRIPT,
    '--bundle-root', bundleRoot,
    '--target-chat-title', 'メンバー',
    '--target-alias', 'member-self-test',
    '--force',
  ], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  const result = JSON.parse(output);
  const policy = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'policy.local.json'), 'utf8'));
  const scenario = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'scenarios', 'execute_smoke.json'), 'utf8'));
  const acceptance = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'acceptance.manual.json'), 'utf8'));
  const readme = fs.readFileSync(path.join(bundleRoot, 'README.md'), 'utf8');

  assert.equal(result.ok, true);
  assert.equal(result.bundle_root, bundleRoot);
  assert.equal(policy.enabled, false);
  assert.equal(policy.dry_run_default, true);
  assert.deepEqual(policy.allowed_targets[0].allowed_send_modes, ['dry_run']);
  assert.equal(policy.allowed_targets[0].expected_chat_title, 'メンバー');
  assert.equal(scenario.scenario_id, 'member_only_execute_smoke');
  assert.equal(acceptance.self_test_target_ready, false);
  assert.match(readme, /member-only self-test LINE chat/);
  assert.match(readme, /メンバー/);
  assert.match(readme, /line-desktop-patrol:execute-once/);
  assert.ok(fs.existsSync(path.join(bundleRoot, 'soak', 'policy.soak.json')));
  assert.ok(fs.existsSync(path.join(bundleRoot, 'soak', 'acceptance.soak.json')));
});
