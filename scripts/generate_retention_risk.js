'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_LIFECYCLE_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'data_lifecycle.json');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'retention_risk.json');
const BUDGETS_PATH = path.join(ROOT, 'docs', 'RETENTION_BUDGETS.md');

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function resolveGeneratedAt() {
  try {
    const value = childProcess.execSync('git log -1 --format=%cI -- docs/REPO_AUDIT_INPUTS/data_lifecycle.json', {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString('utf8').trim();
    if (value) return value;
  } catch (_err) {
    // fall through
  }
  return 'NOT_AVAILABLE';
}

function buildSourceDigest(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function toNameArray(rows) {
  return rows
    .map((row) => (row && typeof row.collection === 'string' ? row.collection : null))
    .filter(Boolean)
    .sort();
}

function buildKindBreakdown(rows) {
  return rows.reduce((acc, row) => {
    const kind = row && typeof row.kind === 'string' ? row.kind : 'unknown';
    acc[kind] = Number(acc[kind] || 0) + 1;
    return acc;
  }, {});
}

function buildPayload() {
  const raw = fs.readFileSync(DATA_LIFECYCLE_PATH, 'utf8');
  const rows = JSON.parse(raw);
  const normalizedRows = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];

  const undefinedRows = normalizedRows.filter((row) => row.retention === 'UNDEFINED_IN_CODE');
  const undefinedConditionalRows = undefinedRows.filter((row) => row.deletable === 'CONDITIONAL');
  const undefinedRecomputableRows = undefinedRows.filter((row) => row.recomputable === true);

  return {
    generatedAt: resolveGeneratedAt(),
    source: toPosix(path.relative(ROOT, DATA_LIFECYCLE_PATH)),
    sourceDigest: buildSourceDigest(raw),
    collection_count: normalizedRows.length,
    undefined_retention_count: undefinedRows.length,
    undefined_deletable_conditional_count: undefinedConditionalRows.length,
    undefined_recomputable_count: undefinedRecomputableRows.length,
    undefined_kind_breakdown: buildKindBreakdown(undefinedRows),
    undefined_collections: toNameArray(undefinedRows),
    undefined_deletable_conditional_collections: toNameArray(undefinedConditionalRows),
    undefined_recomputable_collections: toNameArray(undefinedRecomputableRows),
    assumptions: [
      'derived from docs/REPO_AUDIT_INPUTS/data_lifecycle.json',
      'retention=UNDEFINED_IN_CODE is treated as unresolved retention policy',
      'budget checks are sourced from docs/RETENTION_BUDGETS.md latest baseline'
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
    undefined_retention_max: parseLastBudgetValue(text, 'undefined_retention_max'),
    undefined_deletable_conditional_max: parseLastBudgetValue(text, 'undefined_deletable_conditional_max'),
    undefined_recomputable_max: parseLastBudgetValue(text, 'undefined_recomputable_max')
  };
}

function verifyBudget(payload) {
  const budget = readBudget();
  if (!budget) return;

  if (
    Number.isFinite(budget.undefined_retention_max)
    && Number(payload.undefined_retention_count) > budget.undefined_retention_max
  ) {
    throw new Error(
      `retention undefined count exceeds budget (${payload.undefined_retention_count} > ${budget.undefined_retention_max})`
    );
  }
  if (
    Number.isFinite(budget.undefined_deletable_conditional_max)
    && Number(payload.undefined_deletable_conditional_count) > budget.undefined_deletable_conditional_max
  ) {
    throw new Error(
      'retention undefined conditional-deletable count exceeds budget'
      + ` (${payload.undefined_deletable_conditional_count} > ${budget.undefined_deletable_conditional_max})`
    );
  }
  if (
    Number.isFinite(budget.undefined_recomputable_max)
    && Number(payload.undefined_recomputable_count) > budget.undefined_recomputable_max
  ) {
    throw new Error(
      `retention undefined recomputable count exceeds budget (${payload.undefined_recomputable_count}`
      + ` > ${budget.undefined_recomputable_max})`
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
      process.stderr.write('retention_risk.json is invalid JSON. run: npm run retention-risk:generate\n');
      process.exit(1);
    }
    if (!currentJson) {
      process.stderr.write('retention_risk.json is stale. run: npm run retention-risk:generate\n');
      process.exit(1);
    }
    const comparableCurrent = Object.assign({}, currentJson);
    const comparableNext = Object.assign({}, payload);
    delete comparableCurrent.generatedAt;
    delete comparableNext.generatedAt;
    if (JSON.stringify(comparableCurrent) !== JSON.stringify(comparableNext)) {
      process.stderr.write('retention_risk.json is stale. run: npm run retention-risk:generate\n');
      process.exit(1);
    }
    try {
      verifyBudget(payload);
    } catch (err) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    process.stdout.write('retention_risk.json is up to date and within budgets\n');
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, next, 'utf8');
  process.stdout.write(`generated: ${toPosix(path.relative(ROOT, OUTPUT_PATH))}\n`);
}

run();
