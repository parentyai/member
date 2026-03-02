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

function evaluateDrift(current, baseline, resolved) {
  const currentScenario = uniqSorted(current && current.scenario || []);
  const currentScenarioKey = uniqSorted(current && current.scenarioKey || []);
  const baselineScenario = uniqSorted(baseline && baseline.scenario || []);
  const baselineScenarioKey = uniqSorted(baseline && baseline.scenarioKey || []);
  const resolvedScenario = uniqSorted(resolved && resolved.scenario || []);
  const resolvedScenarioKey = uniqSorted(resolved && resolved.scenarioKey || []);

  const scenarioAdded = currentScenario.filter((item) => !baselineScenario.includes(item));
  const scenarioKeyAdded = currentScenarioKey.filter((item) => !baselineScenarioKey.includes(item));
  const scenarioRevived = currentScenario.filter((item) => resolvedScenario.includes(item));
  const scenarioKeyRevived = currentScenarioKey.filter((item) => resolvedScenarioKey.includes(item));

  return {
    currentScenario,
    currentScenarioKey,
    baselineScenario,
    baselineScenarioKey,
    resolvedScenario,
    resolvedScenarioKey,
    scenarioAdded,
    scenarioKeyAdded,
    scenarioRevived,
    scenarioKeyRevived
  };
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

  const report = evaluateDrift(
    {
      scenario: namingDrift.scenario || [],
      scenarioKey: namingDrift.scenarioKey || []
    },
    allowlist.allowlist || {},
    allowlist.resolved || {}
  );

  process.stdout.write(
    `scenariokey_drift current scenario=${report.currentScenario.length} scenarioKey=${report.currentScenarioKey.length}`
    + ` baseline_scenario=${report.baselineScenario.length} baseline_scenarioKey=${report.baselineScenarioKey.length}\n`
  );

  if (report.scenarioAdded.length || report.scenarioKeyAdded.length || report.scenarioRevived.length || report.scenarioKeyRevived.length) {
    process.stderr.write('scenarioKey drift budget exceeded\n');
    if (report.scenarioAdded.length) {
      process.stderr.write(`new scenario alias paths:\n - ${report.scenarioAdded.join('\n - ')}\n`);
    }
    if (report.scenarioKeyAdded.length) {
      process.stderr.write(`new scenarioKey drift paths:\n - ${report.scenarioKeyAdded.join('\n - ')}\n`);
    }
    if (report.scenarioRevived.length) {
      process.stderr.write(`resolved scenario alias reintroduced:\n - ${report.scenarioRevived.join('\n - ')}\n`);
    }
    if (report.scenarioKeyRevived.length) {
      process.stderr.write(`resolved scenarioKey drift reintroduced:\n - ${report.scenarioKeyRevived.join('\n - ')}\n`);
    }
    process.stderr.write(`update SSOT only with explicit review: ${path.relative(ROOT, ALLOWLIST_PATH)}\n`);
    process.exit(1);
  }

  process.stdout.write('scenarioKey drift baseline is stable\n');
}

if (require.main === module) run();

module.exports = {
  evaluateDrift,
  uniqSorted
};
