'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DESIGN_META_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'design_ai_meta.json');
const ALLOWLIST_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'scenario_key_drift_allowlist.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function uniqSorted(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function run() {
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    process.stderr.write(`scenarioKey allowlist missing: ${path.relative(ROOT, ALLOWLIST_PATH)}\n`);
    process.exit(1);
  }

  const designMeta = readJson(DESIGN_META_PATH);
  const allowlist = readJson(ALLOWLIST_PATH);
  const namingDrift = designMeta && designMeta.naming_drift && typeof designMeta.naming_drift === 'object'
    ? designMeta.naming_drift
    : {};

  const currentScenario = uniqSorted(namingDrift.scenario || []);
  const currentScenarioKey = uniqSorted(namingDrift.scenarioKey || []);

  const baselineScenario = uniqSorted(allowlist.allowlist && allowlist.allowlist.scenario || []);
  const baselineScenarioKey = uniqSorted(allowlist.allowlist && allowlist.allowlist.scenarioKey || []);

  const scenarioAdded = currentScenario.filter((item) => !baselineScenario.includes(item));
  const scenarioKeyAdded = currentScenarioKey.filter((item) => !baselineScenarioKey.includes(item));

  process.stdout.write(
    `scenariokey_drift current scenario=${currentScenario.length} scenarioKey=${currentScenarioKey.length}`
    + ` baseline_scenario=${baselineScenario.length} baseline_scenarioKey=${baselineScenarioKey.length}\n`
  );

  if (scenarioAdded.length || scenarioKeyAdded.length) {
    process.stderr.write('scenarioKey drift budget exceeded\n');
    if (scenarioAdded.length) {
      process.stderr.write(`new scenario alias paths:\n - ${scenarioAdded.join('\n - ')}\n`);
    }
    if (scenarioKeyAdded.length) {
      process.stderr.write(`new scenarioKey drift paths:\n - ${scenarioKeyAdded.join('\n - ')}\n`);
    }
    process.stderr.write(`update SSOT only with explicit review: ${path.relative(ROOT, ALLOWLIST_PATH)}\n`);
    process.exit(1);
  }

  process.stdout.write('scenarioKey drift baseline is stable\n');
}

run();
