'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DESIGN_AI_META_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'design_ai_meta.json');
const DEPENDENCY_GRAPH_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'dependency_graph.json');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'structure_risk.json');
const BUDGETS_PATH = path.join(ROOT, 'docs', 'STRUCTURE_BUDGETS.md');

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function resolveGeneratedAt() {
  return new Date().toISOString();
}

function buildSourceDigest(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).sort()
    : [];
}

function normalizePairArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .map((pair) => [String(pair[0]), String(pair[1])])
    .sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`));
}

function readUsecaseToRepo() {
  if (!fs.existsSync(DEPENDENCY_GRAPH_PATH)) return {};
  try {
    const payload = JSON.parse(fs.readFileSync(DEPENDENCY_GRAPH_PATH, 'utf8'));
    if (payload && typeof payload.usecase_to_repo === 'object' && payload.usecase_to_repo !== null) {
      return payload.usecase_to_repo;
    }
  } catch (_err) {
    // fallback below
  }
  return {};
}

function countActiveLegacyRepoImports(legacyRepos, usecaseToRepo) {
  if (!Array.isArray(legacyRepos) || !legacyRepos.length) return 0;
  const legacySet = new Set(legacyRepos.map((item) => String(item)));
  let count = 0;
  Object.values(usecaseToRepo || {}).forEach((repos) => {
    if (!Array.isArray(repos)) return;
    repos.forEach((repoName) => {
      if (legacySet.has(String(repoName))) count += 1;
    });
  });
  return count;
}

function buildPayload() {
  const raw = fs.readFileSync(DESIGN_AI_META_PATH, 'utf8');
  const meta = JSON.parse(raw);
  const canonicalRepos = normalizeStringArray(meta.canonical_repos);
  const legacyRepos = normalizeStringArray(meta.legacy_repos);
  const mergeCandidates = normalizePairArray(meta.merge_candidates);
  const unresolvedDynamicDep = normalizeStringArray(meta.unresolved_dynamic_dep);
  const namingDrift = meta && typeof meta.naming_drift === 'object' ? meta.naming_drift : {};
  const namingDriftScenario = normalizeStringArray(namingDrift.scenario);
  const namingDriftScenarioKey = normalizeStringArray(namingDrift.scenarioKey);
  const usecaseToRepo = readUsecaseToRepo();
  const activeLegacyRepoImportsCount = countActiveLegacyRepoImports(legacyRepos, usecaseToRepo);

  return {
    generatedAt: resolveGeneratedAt(),
    source: toPosix(path.relative(ROOT, DESIGN_AI_META_PATH)),
    sourceDigest: buildSourceDigest(raw),
    canonical_repos_count: canonicalRepos.length,
    legacy_repos_count: legacyRepos.length,
    merge_candidates_count: mergeCandidates.length,
    unresolved_dynamic_dep_count: unresolvedDynamicDep.length,
    active_legacy_repo_imports_count: activeLegacyRepoImportsCount,
    naming_drift_scenario_count: namingDriftScenario.length,
    naming_drift_scenarioKey_count: namingDriftScenarioKey.length,
    canonical_repos: canonicalRepos,
    legacy_repos: legacyRepos,
    merge_candidates: mergeCandidates,
    unresolved_dynamic_dep: unresolvedDynamicDep,
    naming_drift: {
      scenario: namingDriftScenario,
      scenarioKey: namingDriftScenarioKey
    },
    assumptions: [
      'derived from docs/REPO_AUDIT_INPUTS/design_ai_meta.json',
      'active_legacy_repo_imports_count is derived from docs/REPO_AUDIT_INPUTS/dependency_graph.json usecase_to_repo',
      'merge_candidates_count indicates duplicate/alias convergence debt',
      'budget checks are sourced from docs/STRUCTURE_BUDGETS.md latest baseline'
    ]
  };
}

function parseLastBudgetValue(text, key) {
  const pattern = new RegExp(`${key}:\\s*(\\d+)`, 'g');
  const matches = [...text.matchAll(pattern)];
  if (!matches.length) return null;
  return Number(matches[matches.length - 1][1]);
}

function readBudget() {
  if (!fs.existsSync(BUDGETS_PATH)) return null;
  const text = fs.readFileSync(BUDGETS_PATH, 'utf8');
  return {
    legacy_repos_max: parseLastBudgetValue(text, 'legacy_repos_max'),
    merge_candidates_max: parseLastBudgetValue(text, 'merge_candidates_max'),
    naming_drift_scenario_max: parseLastBudgetValue(text, 'naming_drift_scenario_max'),
    unresolved_dynamic_dep_max: parseLastBudgetValue(text, 'unresolved_dynamic_dep_max'),
    active_legacy_repo_imports_max: parseLastBudgetValue(text, 'active_legacy_repo_imports_max')
  };
}

function verifyBudget(payload) {
  const budget = readBudget();
  if (!budget) return;

  if (Number.isFinite(budget.legacy_repos_max) && Number(payload.legacy_repos_count) > budget.legacy_repos_max) {
    throw new Error(`structure legacy repos exceeds budget (${payload.legacy_repos_count} > ${budget.legacy_repos_max})`);
  }
  if (
    Number.isFinite(budget.merge_candidates_max)
    && Number(payload.merge_candidates_count) > budget.merge_candidates_max
  ) {
    throw new Error(
      `structure duplicate merge candidates exceeds budget (${payload.merge_candidates_count} > ${budget.merge_candidates_max})`
    );
  }
  if (
    Number.isFinite(budget.naming_drift_scenario_max)
    && Number(payload.naming_drift_scenario_count) > budget.naming_drift_scenario_max
  ) {
    throw new Error(
      `structure naming drift scenario exceeds budget (${payload.naming_drift_scenario_count} > ${budget.naming_drift_scenario_max})`
    );
  }
  if (
    Number.isFinite(budget.unresolved_dynamic_dep_max)
    && Number(payload.unresolved_dynamic_dep_count) > budget.unresolved_dynamic_dep_max
  ) {
    throw new Error(
      `structure unresolved dynamic dep exceeds budget (${payload.unresolved_dynamic_dep_count} > ${budget.unresolved_dynamic_dep_max})`
    );
  }
  if (
    Number.isFinite(budget.active_legacy_repo_imports_max)
    && Number(payload.active_legacy_repo_imports_count) > budget.active_legacy_repo_imports_max
  ) {
    throw new Error(
      'structure active legacy repo imports exceeds budget'
      + ` (${payload.active_legacy_repo_imports_count} > ${budget.active_legacy_repo_imports_max})`
    );
  }
}

function run() {
  const checkMode = process.argv.includes('--check');
  const payload = buildPayload();
  const next = `${JSON.stringify(payload, null, 2)}\n`;

  if (checkMode) {
    const currentRaw = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : '';
    let currentJson = null;
    try {
      currentJson = currentRaw ? JSON.parse(currentRaw) : null;
    } catch (_err) {
      process.stderr.write('structure_risk.json is invalid JSON. run: npm run structure-risk:generate\n');
      process.exit(1);
    }
    if (!currentJson) {
      process.stderr.write('structure_risk.json is stale. run: npm run structure-risk:generate\n');
      process.exit(1);
    }
    const comparableCurrent = Object.assign({}, currentJson);
    const comparableNext = Object.assign({}, payload);
    delete comparableCurrent.generatedAt;
    delete comparableNext.generatedAt;
    if (JSON.stringify(comparableCurrent) !== JSON.stringify(comparableNext)) {
      process.stderr.write('structure_risk.json is stale. run: npm run structure-risk:generate\n');
      process.exit(1);
    }
    try {
      verifyBudget(payload);
    } catch (err) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    process.stdout.write('structure_risk.json is up to date and within budgets\n');
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, next, 'utf8');
  process.stdout.write(`generated: ${toPosix(path.relative(ROOT, OUTPUT_PATH))}\n`);
}

run();
