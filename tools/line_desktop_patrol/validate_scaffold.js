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
  path.join(TOOL_ROOT, 'scenarios', 'strategic_self_improvement_batch_v1.json'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', '__init__.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'policy.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'runtime_state.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'trace_store.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'proposal_queue.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'mcp_server.py'),
  path.join(TOOL_ROOT, 'read_repo_runtime_state.js'),
  path.join(TOOL_ROOT, 'desktop_ui_bridge.js'),
  path.join(TOOL_ROOT, 'desktop_ui_bridge.swift'),
  path.join(TOOL_ROOT, 'send_text_bridge.js'),
  path.join(TOOL_ROOT, 'run_mcp_server.sh'),
  path.join(TOOL_ROOT, 'run_local_mcp_tool.js'),
  path.join(TOOL_ROOT, 'run_desktop_self_improvement_batch.js')
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
  const strategicBatch = readJson(path.join(TOOL_ROOT, 'scenarios', 'strategic_self_improvement_batch_v1.json'));

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
  assert(strategicBatch.fixed_case_count === 10, 'strategic self improvement batch must stay fixed at 10 cases');
  assert(Array.isArray(strategicBatch.cases) && strategicBatch.cases.length === 10, 'strategic self improvement batch needs exactly 10 cases');
  assert(strategicBatch.cases.every((item) => typeof item.case_id === 'string' && item.case_id.length > 0), 'strategic batch cases need case_id');
  assert(strategicBatch.cases.every((item) => typeof item.strategic_goal === 'string' && item.strategic_goal.length > 0), 'strategic batch cases need strategic_goal');
  assert(strategicBatch.cases.every((item) => typeof item.improvement_axis === 'string' && item.improvement_axis.length > 0), 'strategic batch cases need improvement_axis');
  assert(strategicBatch.cases.every((item) => item.reply_contract && Array.isArray(item.reply_contract.must_include_any) && item.reply_contract.must_include_any.length > 0), 'strategic batch cases need reply_contract.must_include_any');

  return {
    ok: true,
    schemaCount: schemas.length,
    sampleTargetCount: allowedTargets.length,
    scenarioId: scenario.scenario_id,
    strategicBatchId: strategicBatch.batch_id
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
