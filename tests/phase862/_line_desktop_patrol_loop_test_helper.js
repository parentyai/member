'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PYTHONPATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'src');
const POLICY_EXAMPLE_PATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'config', 'policy.example.json');
const SCENARIO_EXAMPLE_PATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'scenarios', 'smoke_dry_run.example.json');

function makeTempRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function clonePolicy(overrides) {
  return Object.assign({}, readJson(POLICY_EXAMPLE_PATH), overrides || {});
}

function writePolicy(filePath, overrides) {
  writeJson(filePath, clonePolicy(overrides));
}

function buildRuntimeStateFixture(overrides) {
  const base = {
    ok: true,
    degraded: false,
    generatedAt: '2026-03-25T12:00:00.000Z',
    repoRoot: ROOT,
    routeKey: 'line-desktop-patrol',
    gitSha: 'fixture_git_sha',
    serviceMode: 'member',
    firestoreProjectId: 'fixture-project',
    firestoreProjectIdSource: 'fixture',
    global: {
      killSwitch: false,
      publicWriteSafety: {
        killSwitchOn: false,
        failCloseMode: false,
        trackAuditWriteMode: 'audit_only',
        readError: false,
        source: 'fixture'
      },
      notificationCaps: {
        perUserWeeklyCap: null,
        perUserDailyCap: null,
        perCategoryWeeklyCap: null,
        quietHours: null
      },
      llmEnabled: true,
      automationConfig: {
        enabled: false,
        mode: 'OFF',
        allowScenarios: [],
        allowSteps: [],
        allowNextActions: [],
        updatedAt: null
      }
    },
    readErrors: []
  };
  return Object.assign({}, base, overrides || {}, {
    global: Object.assign({}, base.global, overrides && overrides.global ? overrides.global : {})
  });
}

function writeRuntimeStateFixture(filePath, overrides) {
  writeJson(filePath, buildRuntimeStateFixture(overrides));
}

function writeLoopState(outputRoot, payload) {
  const statePath = path.join(outputRoot, 'runtime', 'state.json');
  writeJson(statePath, payload);
  return statePath;
}

function runLoop(args) {
  const outputRoot = args.outputRoot;
  const latestSummaryPath = args.latestSummaryPath || path.join(outputRoot, 'latest_summary.json');
  const runtimeStatePath = args.runtimeStatePath;
  const commandArgs = [
    '-m',
    'member_line_patrol.patrol_loop',
    '--policy',
    args.policyPath,
    '--scenario',
    args.scenarioPath || SCENARIO_EXAMPLE_PATH,
    '--output-root',
    outputRoot,
    '--route-key',
    'line-desktop-patrol',
    '--now',
    args.now,
    '--latest-summary-path',
    latestSummaryPath
  ];
  if (runtimeStatePath) {
    commandArgs.push('--runtime-state-path', runtimeStatePath);
  }
  if (args.allowDisabledPolicy) {
    commandArgs.push('--allow-disabled-policy');
  }
  const output = execFileSync('python3', commandArgs, {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH }),
    encoding: 'utf8'
  });
  return JSON.parse(output);
}

module.exports = {
  POLICY_EXAMPLE_PATH,
  ROOT,
  SCENARIO_EXAMPLE_PATH,
  buildRuntimeStateFixture,
  clonePolicy,
  makeTempRoot,
  readJson,
  runLoop,
  writeJson,
  writeLoopState,
  writePolicy,
  writeRuntimeStateFixture
};
