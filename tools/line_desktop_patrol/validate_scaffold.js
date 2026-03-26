'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TOOL_ROOT = path.join(ROOT, 'tools', 'line_desktop_patrol');

const SCHEMA_FILES = [
  path.join(ROOT, 'schemas', 'line_desktop_patrol_policy.schema.json'),
  path.join(ROOT, 'schemas', 'line_desktop_patrol_trace.schema.json'),
  path.join(ROOT, 'schemas', 'line_desktop_patrol_scenario.schema.json'),
  path.join(ROOT, 'schemas', 'line_desktop_patrol_proposal.schema.json')
];

const REQUIRED_FILES = [
  path.join(TOOL_ROOT, 'README.md'),
  path.join(TOOL_ROOT, 'pyproject.toml'),
  path.join(TOOL_ROOT, 'config', 'policy.example.json'),
  path.join(TOOL_ROOT, 'config', 'allowed_targets.example.json'),
  path.join(TOOL_ROOT, 'scenarios', 'smoke_dry_run.example.json'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', '__init__.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'macos_adapter.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'policy.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'runtime_state.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'scenario_loader.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'trace_store.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'proposal_queue.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'proposal_builder.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'enqueue_eval_proposals.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'dry_run_harness.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'loop_state.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'patrol_loop.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'mcp_server.py'),
  path.join(TOOL_ROOT, 'read_repo_runtime_state.js'),
  path.join(ROOT, 'tools', 'quality_patrol', 'run_desktop_patrol_eval.js'),
  path.join(ROOT, 'src', 'usecases', 'qualityPatrol', 'buildConversationReviewUnitsFromDesktopTrace.js'),
  path.join(ROOT, 'docs', 'LINE_DESKTOP_PATROL_CODEX_CONTRACT.md')
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runValidation() {
  REQUIRED_FILES.forEach((filePath) => {
    assert(fs.existsSync(filePath), `required file missing: ${filePath}`);
  });

  const schemas = SCHEMA_FILES.map((filePath) => {
    const schema = readJson(filePath);
    assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', `unexpected schema draft: ${filePath}`);
    assert(typeof schema.title === 'string' && schema.title.length > 0, `missing schema title: ${filePath}`);
    return schema;
  });

  const policy = readJson(path.join(TOOL_ROOT, 'config', 'policy.example.json'));
  const allowedTargets = readJson(path.join(TOOL_ROOT, 'config', 'allowed_targets.example.json'));
  const scenario = readJson(path.join(TOOL_ROOT, 'scenarios', 'smoke_dry_run.example.json'));
  const packageJson = readJson(path.join(ROOT, 'package.json'));

  assert(policy.enabled === false, 'policy.example enabled must stay false');
  assert(policy.dry_run_default === true, 'policy.example dry_run_default must stay true');
  assert(policy.require_target_confirmation === true, 'policy.example require_target_confirmation must stay true');
  assert(policy.auto_apply_level === 'none', 'policy.example auto_apply_level must stay none');
  assert(policy.proposal_mode === 'local_queue', 'policy.example proposal_mode must stay local_queue');
  assert(Array.isArray(policy.allowed_targets) && policy.allowed_targets.length > 0, 'policy.example needs at least one allowed target');
  assert(Array.isArray(allowedTargets) && allowedTargets.length > 0, 'allowed_targets.example needs at least one target');
  assert(policy.allowed_targets.every((target) => Array.isArray(target.allowed_send_modes) && target.allowed_send_modes.every((mode) => mode === 'dry_run')), 'policy.example must stay dry_run-only');
  assert(allowedTargets.every((target) => Array.isArray(target.allowed_send_modes) && target.allowed_send_modes.every((mode) => mode === 'dry_run')), 'allowed_targets.example must stay dry_run-only');
  assert(typeof scenario.scenario_id === 'string' && scenario.scenario_id.length > 0, 'scenario example needs scenario_id');
  assert(Array.isArray(scenario.expected_behavior) && scenario.expected_behavior.length > 0, 'scenario example needs expected_behavior');
  assert(packageJson.scripts['line-desktop-patrol:probe'], 'package.json must define line-desktop-patrol:probe');
  assert(packageJson.scripts['line-desktop-patrol:dry-run'], 'package.json must define line-desktop-patrol:dry-run');
  assert(packageJson.scripts['line-desktop-patrol:loop'], 'package.json must define line-desktop-patrol:loop');
  assert(packageJson.scripts['line-desktop-patrol:evaluate'], 'package.json must define line-desktop-patrol:evaluate');
  assert(packageJson.scripts['line-desktop-patrol:enqueue-proposals'], 'package.json must define line-desktop-patrol:enqueue-proposals');
  assert(packageJson.scripts['test:phase858'], 'package.json must define test:phase858');
  assert(packageJson.scripts['test:phase859'], 'package.json must define test:phase859');
  assert(packageJson.scripts['test:phase860'], 'package.json must define test:phase860');
  assert(packageJson.scripts['test:phase862'], 'package.json must define test:phase862');
  assert(packageJson.scripts['test:phase863'], 'package.json must define test:phase863');
  assert(packageJson.scripts['test:phase864'], 'package.json must define test:phase864');

  return {
    ok: true,
    schemaCount: schemas.length,
    sampleTargetCount: allowedTargets.length,
    scenarioId: scenario.scenario_id,
    hasDryRunScript: true
  };
}

function main() {
  const result = runValidation();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: error && error.message ? error.message : String(error)
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  runValidation
};
