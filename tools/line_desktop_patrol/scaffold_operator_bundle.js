'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TOOL_ROOT = path.join(ROOT, 'tools', 'line_desktop_patrol');
const CONFIG_ROOT = path.join(TOOL_ROOT, 'config');
const SCENARIO_ROOT = path.join(TOOL_ROOT, 'scenarios');
const DEFAULT_BUNDLE_ROOT = path.join(os.homedir(), 'member-line-desktop-patrol');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const out = {
    bundleRoot: DEFAULT_BUNDLE_ROOT,
    targetAlias: 'member-self-test',
    targetChatTitle: '',
    force: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--bundle-root') {
      out.bundleRoot = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === '--target-alias') {
      out.targetAlias = String(argv[index + 1] || '').trim() || out.targetAlias;
      index += 1;
      continue;
    }
    if (token === '--target-chat-title') {
      out.targetChatTitle = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (token === '--force') {
      out.force = true;
      continue;
    }
    throw new Error(`unknown argument: ${token}`);
  }
  return out;
}

function ensureCleanBundleRoot(bundleRoot, force) {
  if (!fs.existsSync(bundleRoot)) {
    fs.mkdirSync(bundleRoot, { recursive: true });
    return;
  }
  const entries = fs.readdirSync(bundleRoot);
  assert(force || entries.length === 0, `bundle root already exists and is not empty: ${bundleRoot}`);
}

function buildLocalPolicy({ targetAlias, targetChatTitle }) {
  const basePolicy = readJson(path.join(CONFIG_ROOT, 'policy.example.json'));
  const sampleTarget = Array.isArray(basePolicy.allowed_targets) && basePolicy.allowed_targets.length > 0
    ? basePolicy.allowed_targets[0]
    : {};
  return Object.assign({}, basePolicy, {
    enabled: false,
    dry_run_default: true,
    allowed_targets: [
      Object.assign({}, sampleTarget, {
        alias: targetAlias,
        expected_chat_title: targetChatTitle || sampleTarget.expected_chat_title || 'REPLACE_WITH_MEMBER_ONLY_CHAT_TITLE',
        expected_window_title_substring: sampleTarget.expected_window_title_substring || 'LINE',
        expected_participant_labels: targetChatTitle ? [] : Array.isArray(sampleTarget.expected_participant_labels) ? sampleTarget.expected_participant_labels : [],
        allowed_send_modes: ['dry_run'],
        notes: 'Machine-local only. Restrict this to one member-only self-test chat such as "メンバー". Keep tracked repo config dry_run-only until you intentionally enable execute in this local copy.',
      }),
    ],
  });
}

function buildLocalScenario(targetChatTitle) {
  const baseScenario = readJson(path.join(SCENARIO_ROOT, 'smoke_dry_run.example.json'));
  const titleSuffix = targetChatTitle ? `対象チャットは ${targetChatTitle} だけです。` : '対象チャットは member-only self-test chat だけです。';
  return Object.assign({}, baseScenario, {
    scenario_id: 'member_only_execute_smoke',
    user_input: `これは member-only self evaluation 用の execute smoke シナリオです。${titleSuffix}`,
    expected_behavior: [
      'target_validated',
      'message_sent',
      'trace_recorded',
      'proposal_queued',
    ],
    expected_routing: [
      'desktop_patrol',
      'execute_evaluation',
    ],
    forbidden_patterns: [
      'send_without_confirmation',
      'send_to_non_member_target',
      'auto_apply_patch',
      'target_mismatch_ignored',
    ],
  });
}

function buildManualReport() {
  const manual = readJson(path.join(CONFIG_ROOT, 'acceptance.manual.example.json'));
  return Object.assign({}, manual, {
    notes: [
      'Copy this file outside the repo for machine-local acceptance tracking.',
      'Only use the member-only self-test LINE chat for execute acceptance.',
      'Do not commit execute-enabled overrides or host-specific evidence.',
    ],
  });
}

function buildReadme({ bundleRoot, targetAlias, targetChatTitle }) {
  const titleLabel = targetChatTitle || 'your member-only self-test chat';
  return [
    '# Member LINE Desktop Patrol Operator Bundle',
    '',
    'This directory is machine-local and must stay outside the repo.',
    '',
    '## Safety rules',
    '- Use only one member-only self-test LINE chat.',
    `- Pin \`policy.local.json\` to the exact chat title, for example \`${titleLabel}\`.`,
    '- Keep tracked repo examples dry-run only. Enable execute only in this local copy.',
    '- Do not commit this directory or any generated trace, screenshot, AX, or visible evidence.',
    '',
    '## Files',
    `- \`policy.local.json\`: local override for alias \`${targetAlias}\``,
    '- `acceptance.manual.json`: manual acceptance and soak counters',
    '- `scenarios/execute_smoke.json`: local execute smoke scenario',
    '- `soak/policy.soak.json`: local soak policy copy',
    '- `soak/acceptance.soak.json`: local soak acceptance counters',
    '',
    '## Suggested activation flow',
    '1. Edit `policy.local.json` and confirm `allowed_targets[0].expected_chat_title` matches the member-only self-test chat exactly.',
    '2. Keep `enabled=false` and `allowed_send_modes=["dry_run"]` until `open-target` and `doctor` succeed.',
    '3. When ready for a supervised execute test, change only this local file:',
    '   - `enabled=true`',
    '   - `dry_run_default=false`',
    '   - `allowed_targets[0].allowed_send_modes=["execute"]`',
    '4. Run these commands from the repo root:',
    `   - \`npm run line-desktop-patrol:open-target -- --policy ${path.join(bundleRoot, 'policy.local.json')} --scenario ${path.join(bundleRoot, 'scenarios', 'execute_smoke.json')}\``,
    `   - \`npm run line-desktop-patrol:execute-once -- --policy ${path.join(bundleRoot, 'policy.local.json')} --scenario ${path.join(bundleRoot, 'scenarios', 'execute_smoke.json')}\``,
    `   - \`npm run line-desktop-patrol:acceptance-gate -- --manual-report ${path.join(bundleRoot, 'acceptance.manual.json')}\``,
    '5. For soak, copy the same execute-ready settings into `soak/policy.soak.json` and run `line-desktop-patrol:loop-execute` against that file only.',
    '',
    '## Stop',
    '- Set `enabled=false` in both local policy files.',
    '- Turn on the existing repo-side global kill switch if any execute run must stop immediately.',
  ].join('\n');
}

function scaffoldOperatorBundle(options) {
  const bundleRoot = path.resolve(options.bundleRoot);
  ensureCleanBundleRoot(bundleRoot, options.force);

  const scenariosRoot = path.join(bundleRoot, 'scenarios');
  const soakRoot = path.join(bundleRoot, 'soak');
  fs.mkdirSync(scenariosRoot, { recursive: true });
  fs.mkdirSync(soakRoot, { recursive: true });

  const policyLocalPath = path.join(bundleRoot, 'policy.local.json');
  const acceptanceManualPath = path.join(bundleRoot, 'acceptance.manual.json');
  const scenarioPath = path.join(scenariosRoot, 'execute_smoke.json');
  const soakPolicyPath = path.join(soakRoot, 'policy.soak.json');
  const soakAcceptancePath = path.join(soakRoot, 'acceptance.soak.json');
  const readmePath = path.join(bundleRoot, 'README.md');

  writeJson(policyLocalPath, buildLocalPolicy(options));
  writeJson(acceptanceManualPath, buildManualReport());
  writeJson(scenarioPath, buildLocalScenario(options.targetChatTitle));
  writeJson(soakPolicyPath, buildLocalPolicy(options));
  writeJson(soakAcceptancePath, buildManualReport());
  fs.writeFileSync(readmePath, `${buildReadme({ bundleRoot, targetAlias: options.targetAlias, targetChatTitle: options.targetChatTitle })}\n`, 'utf8');

  return {
    ok: true,
    bundle_root: bundleRoot,
    created_files: {
      policy_local_path: policyLocalPath,
      acceptance_manual_path: acceptanceManualPath,
      scenario_path: scenarioPath,
      soak_policy_path: soakPolicyPath,
      soak_acceptance_path: soakAcceptancePath,
      readme_path: readmePath,
    },
    safe_defaults: {
      enabled: false,
      dry_run_default: true,
      allowed_send_modes: ['dry_run'],
    },
    target_alias: options.targetAlias,
    target_chat_title: options.targetChatTitle || null,
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = scaffoldOperatorBundle(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: error && error.message ? error.message : String(error),
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  scaffoldOperatorBundle,
};
