'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SSOT_RETENTION_PATH = path.join(ROOT, 'docs', 'SSOT_RETENTION.md');
const DATA_LIFECYCLE_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'data_lifecycle.json');
const { listRetentionPolicies } = require(path.join(ROOT, 'src', 'domain', 'retention', 'retentionPolicy'));

function normalizeList(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))).sort();
}

function parseSsotRetentionCollections(text) {
  const rows = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line) => {
    if (!line.startsWith('|')) return;
    const firstCell = String((line.split('|')[1] || '')).trim();
    const match = firstCell.match(/^`?([a-z0-9_]+)(?:\s+\(legacy\))?`?$/i);
    if (!match) return;
    const collection = match[1].toLowerCase();
    if (collection === 'collection') return;
    rows.push(collection);
  });
  return normalizeList(rows);
}

function formatRows(label, values) {
  if (!values.length) return `${label}: none`;
  return `${label}:\n - ${values.join('\n - ')}`;
}

function diff(base, other) {
  const otherSet = new Set(other || []);
  return (base || []).filter((item) => !otherSet.has(item)).sort();
}

function run() {
  const ssotText = fs.readFileSync(SSOT_RETENTION_PATH, 'utf8');
  const lifecycleRows = JSON.parse(fs.readFileSync(DATA_LIFECYCLE_PATH, 'utf8'));
  const policyRows = listRetentionPolicies();

  const ssotCollections = parseSsotRetentionCollections(ssotText);
  const lifecycleCollections = normalizeList((Array.isArray(lifecycleRows) ? lifecycleRows : []).map((row) => row && row.collection));
  const policyCollections = normalizeList((Array.isArray(policyRows) ? policyRows : []).map((row) => row && row.collection));

  const ssotMissingInPolicy = diff(ssotCollections, policyCollections);
  const ssotMissingInLifecycle = diff(ssotCollections, lifecycleCollections);
  const policyMissingInLifecycle = diff(policyCollections, lifecycleCollections);
  const lifecycleMissingInPolicy = diff(lifecycleCollections, policyCollections);

  process.stdout.write(`retention parity: ssot=${ssotCollections.length} policy=${policyCollections.length} lifecycle=${lifecycleCollections.length}\n`);
  process.stdout.write(formatRows('ssot_missing_in_policy', ssotMissingInPolicy) + '\n');
  process.stdout.write(formatRows('ssot_missing_in_lifecycle', ssotMissingInLifecycle) + '\n');
  process.stdout.write(formatRows('policy_missing_in_lifecycle', policyMissingInLifecycle) + '\n');
  process.stdout.write(formatRows('lifecycle_missing_in_policy', lifecycleMissingInPolicy) + '\n');

  const hasMismatch = ssotMissingInPolicy.length
    || ssotMissingInLifecycle.length
    || policyMissingInLifecycle.length
    || lifecycleMissingInPolicy.length;
  if (hasMismatch) {
    process.stderr.write('retention policy parity mismatch detected\n');
    process.stderr.write('fix SSOT_RETENTION / retentionPolicy / data_lifecycle in add-only parity flow\n');
    process.exit(1);
  }

  process.stdout.write('retention policy parity check ok\n');
}

run();

