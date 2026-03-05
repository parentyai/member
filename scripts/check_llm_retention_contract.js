'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getRetentionPolicy } = require('../src/domain/retention/retentionPolicy');

const ROOT = path.resolve(__dirname, '..');
const LIFECYCLE_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'data_lifecycle.json');
const ALLOWLIST_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'collection_drift_allowlist.json');
const RULES_PATH = path.join(ROOT, 'firestore.rules');

const EXPECTED = Object.freeze({
  llm_action_logs: { retentionDays: 180, lifecycleRetention: '180d', ruleSnippet: 'match /llm_action_logs/{docId}' },
  llm_bandit_state: { retentionDays: 'INDEFINITE', lifecycleRetention: 'INDEFINITE', ruleSnippet: 'match /llm_bandit_state/{docId}' },
  llm_contextual_bandit_state: { retentionDays: 'INDEFINITE', lifecycleRetention: 'INDEFINITE', ruleSnippet: 'match /llm_contextual_bandit_state/{docId}' }
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(errors, message) {
  errors.push(message);
}

function checkRetentionPolicies(errors) {
  Object.entries(EXPECTED).forEach(([collection, expected]) => {
    const policy = getRetentionPolicy(collection);
    if (!policy || policy.defined !== true) {
      fail(errors, `retentionPolicy missing for ${collection}`);
      return;
    }
    if (String(policy.retentionDays) !== String(expected.retentionDays)) {
      fail(errors, `retentionPolicy mismatch for ${collection}: got=${String(policy.retentionDays)} expected=${String(expected.retentionDays)}`);
    }
  });
}

function checkLifecycle(errors) {
  const lifecycle = readJson(LIFECYCLE_PATH);
  const map = new Map((Array.isArray(lifecycle) ? lifecycle : []).map((row) => [row && row.collection, row]));
  Object.entries(EXPECTED).forEach(([collection, expected]) => {
    const row = map.get(collection);
    if (!row) {
      fail(errors, `data_lifecycle missing ${collection}`);
      return;
    }
    if (String(row.retention) !== String(expected.lifecycleRetention)) {
      fail(errors, `data_lifecycle retention mismatch for ${collection}: got=${String(row.retention)} expected=${String(expected.lifecycleRetention)}`);
    }
  });
}

function checkRules(errors) {
  const rules = fs.readFileSync(RULES_PATH, 'utf8');
  Object.entries(EXPECTED).forEach(([collection, expected]) => {
    if (!rules.includes(expected.ruleSnippet)) {
      fail(errors, `firestore.rules missing snippet for ${collection}: ${expected.ruleSnippet}`);
    }
  });
}

function checkAllowlist(errors) {
  const allowlist = readJson(ALLOWLIST_PATH);
  const modelOnly = ((((allowlist || {}).allowlist || {}).data_model_only) || []).map((value) => String(value));
  Object.keys(EXPECTED).forEach((collection) => {
    if (modelOnly.includes(collection)) {
      fail(errors, `collection_drift_allowlist still includes ${collection} in data_model_only`);
    }
  });
}

function run() {
  const errors = [];
  checkRetentionPolicies(errors);
  checkLifecycle(errors);
  checkRules(errors);
  checkAllowlist(errors);

  if (errors.length) {
    process.stderr.write('[llm_retention_contract] mismatch detected\n');
    errors.forEach((message) => {
      process.stderr.write(` - ${message}\n`);
    });
    process.exit(1);
  }

  process.stdout.write('[llm_retention_contract] ok\n');
}

if (require.main === module) run();

module.exports = {
  run
};
