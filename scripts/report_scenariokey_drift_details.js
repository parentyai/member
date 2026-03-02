'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));
}

function uniqSorted(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function detectGroup(filePath) {
  const value = String(filePath || '').trim();
  if (!value) return 'unknown';
  if (value.startsWith('src/routes/')) return 'routes';
  if (value.startsWith('src/usecases/')) return 'usecases';
  if (value.startsWith('src/repos/')) return 'repos';
  if (value.startsWith('src/domain/')) return 'domain';
  if (value.startsWith('src/')) return 'src_other';
  return 'other';
}

function groupByArea(paths) {
  const groups = {};
  uniqSorted(paths).forEach((filePath) => {
    const area = detectGroup(filePath);
    if (!Array.isArray(groups[area])) groups[area] = [];
    groups[area].push(filePath);
  });
  return groups;
}

function buildAliasDetail({ alias, current, baseline }) {
  const added = current.filter((item) => !baseline.includes(item));
  const resolvedFromBaseline = baseline.filter((item) => !current.includes(item));
  return {
    alias,
    counts: {
      current: current.length,
      baseline: baseline.length,
      added: added.length,
      resolvedFromBaseline: resolvedFromBaseline.length
    },
    details: {
      addedPaths: added,
      resolvedFromBaselinePaths: resolvedFromBaseline,
      groupedCurrentPaths: groupByArea(current)
    }
  };
}

function run() {
  const designMeta = readJson('docs', 'REPO_AUDIT_INPUTS', 'design_ai_meta.json');
  const allowlist = readJson('docs', 'REPO_AUDIT_INPUTS', 'scenario_key_drift_allowlist.json');
  const namingDrift = designMeta && designMeta.naming_drift && typeof designMeta.naming_drift === 'object'
    ? designMeta.naming_drift
    : {};
  const baseline = allowlist && allowlist.allowlist && typeof allowlist.allowlist === 'object'
    ? allowlist.allowlist
    : {};

  const currentScenario = uniqSorted(namingDrift.scenario || []);
  const currentScenarioKey = uniqSorted(namingDrift.scenarioKey || []);
  const baselineScenario = uniqSorted(baseline.scenario || []);
  const baselineScenarioKey = uniqSorted(baseline.scenarioKey || []);

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      designMeta: 'docs/REPO_AUDIT_INPUTS/design_ai_meta.json',
      allowlist: 'docs/REPO_AUDIT_INPUTS/scenario_key_drift_allowlist.json'
    },
    aliases: [
      buildAliasDetail({
        alias: 'scenario',
        current: currentScenario,
        baseline: baselineScenario
      }),
      buildAliasDetail({
        alias: 'scenarioKey',
        current: currentScenarioKey,
        baseline: baselineScenarioKey
      })
    ]
  };

  process.stdout.write('[scenariokey-drift-details] report\n');
  process.stdout.write(JSON.stringify(report, null, 2));
  process.stdout.write('\n');
}

run();
