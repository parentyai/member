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
  path.join(TOOL_ROOT, 'scaffold_operator_bundle.js'),
  path.join(TOOL_ROOT, 'config', 'policy.example.json'),
  path.join(TOOL_ROOT, 'config', 'allowed_targets.example.json'),
  path.join(TOOL_ROOT, 'config', 'acceptance.manual.example.json'),
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
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'execute_harness.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'execute_loop.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'loop_state.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'patrol_loop.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'doctor.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'mcp_server.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'promote_proposal.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'synthesize_patch_task.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'synthesize_code_patch_bundle.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'synthesize_code_edit_task.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'synthesize_code_diff_draft.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'synthesize_code_edit_bundle.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'synthesize_code_apply_draft.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'synthesize_code_apply_task.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'synthesize_code_review_packet.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'synthesize_code_apply_evidence.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'synthesize_code_apply_signoff.py'),
  path.join(TOOL_ROOT, 'read_repo_runtime_state.js'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'retention.py'),
  path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'acceptance_gate.py'),
  path.join(ROOT, 'tools', 'quality_patrol', 'run_desktop_patrol_eval.js'),
  path.join(ROOT, 'src', 'usecases', 'qualityPatrol', 'buildConversationReviewUnitsFromDesktopTrace.js'),
  path.join(ROOT, 'docs', 'LINE_DESKTOP_PATROL_CODEX_CONTRACT.md'),
  path.join(TOOL_ROOT, 'launchd', 'com.member.line-desktop-patrol.execute-loop.plist.example')
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
  assert(packageJson.scripts['line-desktop-patrol:open-target'], 'package.json must define line-desktop-patrol:open-target');
  assert(packageJson.scripts['line-desktop-patrol:send'], 'package.json must define line-desktop-patrol:send');
  assert(packageJson.scripts['line-desktop-patrol:execute-once'], 'package.json must define line-desktop-patrol:execute-once');
  assert(packageJson.scripts['line-desktop-patrol:loop-execute'], 'package.json must define line-desktop-patrol:loop-execute');
  assert(packageJson.scripts['line-desktop-patrol:evaluate'], 'package.json must define line-desktop-patrol:evaluate');
  assert(packageJson.scripts['line-desktop-patrol:enqueue-proposals'], 'package.json must define line-desktop-patrol:enqueue-proposals');
  assert(packageJson.scripts['line-desktop-patrol:promote-proposal'], 'package.json must define line-desktop-patrol:promote-proposal');
  assert(packageJson.scripts['line-desktop-patrol:synthesize-patch'], 'package.json must define line-desktop-patrol:synthesize-patch');
  assert(packageJson.scripts['line-desktop-patrol:synthesize-code-patch'], 'package.json must define line-desktop-patrol:synthesize-code-patch');
  assert(packageJson.scripts['line-desktop-patrol:synthesize-code-edit'], 'package.json must define line-desktop-patrol:synthesize-code-edit');
  assert(packageJson.scripts['line-desktop-patrol:synthesize-code-diff'], 'package.json must define line-desktop-patrol:synthesize-code-diff');
  assert(packageJson.scripts['line-desktop-patrol:synthesize-code-edit-bundle'], 'package.json must define line-desktop-patrol:synthesize-code-edit-bundle');
  assert(packageJson.scripts['line-desktop-patrol:synthesize-code-apply-draft'], 'package.json must define line-desktop-patrol:synthesize-code-apply-draft');
  assert(packageJson.scripts['line-desktop-patrol:synthesize-code-apply-task'], 'package.json must define line-desktop-patrol:synthesize-code-apply-task');
  assert(packageJson.scripts['line-desktop-patrol:synthesize-code-review-packet'], 'package.json must define line-desktop-patrol:synthesize-code-review-packet');
  assert(packageJson.scripts['line-desktop-patrol:synthesize-code-apply-evidence'], 'package.json must define line-desktop-patrol:synthesize-code-apply-evidence');
  assert(packageJson.scripts['line-desktop-patrol:synthesize-code-apply-signoff'], 'package.json must define line-desktop-patrol:synthesize-code-apply-signoff');
  assert(packageJson.scripts['line-desktop-patrol:scaffold-operator-bundle'], 'package.json must define line-desktop-patrol:scaffold-operator-bundle');
  assert(packageJson.scripts['line-desktop-patrol:doctor'], 'package.json must define line-desktop-patrol:doctor');
  assert(packageJson.scripts['line-desktop-patrol:retention'], 'package.json must define line-desktop-patrol:retention');
  assert(packageJson.scripts['line-desktop-patrol:acceptance-gate'], 'package.json must define line-desktop-patrol:acceptance-gate');
  assert(packageJson.scripts['test:phase858'], 'package.json must define test:phase858');
  assert(packageJson.scripts['test:phase859'], 'package.json must define test:phase859');
  assert(packageJson.scripts['test:phase860'], 'package.json must define test:phase860');
  assert(packageJson.scripts['test:phase862'], 'package.json must define test:phase862');
  assert(packageJson.scripts['test:phase863'], 'package.json must define test:phase863');
  assert(packageJson.scripts['test:phase864'], 'package.json must define test:phase864');
  assert(packageJson.scripts['test:phase865'], 'package.json must define test:phase865');
  assert(packageJson.scripts['test:phase866'], 'package.json must define test:phase866');
  assert(packageJson.scripts['test:phase867'], 'package.json must define test:phase867');
  assert(packageJson.scripts['test:phase868'], 'package.json must define test:phase868');
  assert(packageJson.scripts['test:phase869'], 'package.json must define test:phase869');
  assert(packageJson.scripts['test:phase870'], 'package.json must define test:phase870');
  assert(packageJson.scripts['test:phase871'], 'package.json must define test:phase871');
  assert(packageJson.scripts['test:phase872'], 'package.json must define test:phase872');
  assert(packageJson.scripts['test:phase873'], 'package.json must define test:phase873');
  assert(packageJson.scripts['test:phase874'], 'package.json must define test:phase874');
  assert(packageJson.scripts['test:phase875'], 'package.json must define test:phase875');
  assert(packageJson.scripts['test:phase876'], 'package.json must define test:phase876');
  assert(packageJson.scripts['test:phase877'], 'package.json must define test:phase877');
  assert(packageJson.scripts['test:phase878'], 'package.json must define test:phase878');
  assert(packageJson.scripts['test:phase879'], 'package.json must define test:phase879');
  assert(packageJson.scripts['test:phase880'], 'package.json must define test:phase880');
  assert(packageJson.scripts['test:phase881'], 'package.json must define test:phase881');
  assert(packageJson.scripts['test:phase882'], 'package.json must define test:phase882');
  assert(packageJson.scripts['test:phase883'], 'package.json must define test:phase883');
  assert(packageJson.scripts['test:phase884'], 'package.json must define test:phase884');
  assert(packageJson.scripts['test:phase885'], 'package.json must define test:phase885');
  assert(packageJson.scripts['test:phase886'], 'package.json must define test:phase886');
  assert(packageJson.scripts['test:phase887'], 'package.json must define test:phase887');
  assert(packageJson.scripts['test:phase888'], 'package.json must define test:phase888');
  assert(packageJson.scripts['test:phase889'], 'package.json must define test:phase889');
  assert(packageJson.scripts['test:phase890'], 'package.json must define test:phase890');
  assert(packageJson.scripts['test:phase891'], 'package.json must define test:phase891');
  assert(packageJson.scripts['test:phase892'], 'package.json must define test:phase892');
  assert(packageJson.scripts['test:phase893'], 'package.json must define test:phase893');
  assert(packageJson.scripts['test:phase894'], 'package.json must define test:phase894');
  assert(packageJson.scripts['test:phase895'], 'package.json must define test:phase895');
  assert(packageJson.scripts['test:phase896'], 'package.json must define test:phase896');
  assert(packageJson.scripts['test:phase897'], 'package.json must define test:phase897');
  assert(packageJson.scripts['test:phase898'], 'package.json must define test:phase898');

  const samplePolicy = readJson(path.join(TOOL_ROOT, 'config', 'policy.example.json'));
  assert(samplePolicy.store_ax_tree === false, 'policy.example.json must keep store_ax_tree=false by default');

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
