'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const { test } = require('node:test');

const { getRetentionPolicy } = require('../../src/domain/retention/retentionPolicy');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

test('phase717: retention policy defines llm action/bandit collections', () => {
  const action = getRetentionPolicy('llm_action_logs');
  const bandit = getRetentionPolicy('llm_bandit_state');
  const contextual = getRetentionPolicy('llm_contextual_bandit_state');

  assert.equal(action.defined, true);
  assert.equal(action.retentionDays, 180);
  assert.equal(bandit.defined, true);
  assert.equal(bandit.retentionDays, 'INDEFINITE');
  assert.equal(contextual.defined, true);
  assert.equal(contextual.retentionDays, 'INDEFINITE');
});

test('phase717: lifecycle/addendum/rules align for llm action and bandit collections', () => {
  const lifecycle = readJson('docs/REPO_AUDIT_INPUTS/data_lifecycle.json');
  const addendum = readText('docs/SSOT_RETENTION_ADDENDUM.md');
  const rules = readText('firestore.rules');
  const allowlist = readJson('docs/REPO_AUDIT_INPUTS/collection_drift_allowlist.json');

  const lifecycleMap = new Map(lifecycle.map((row) => [row.collection, row]));
  assert.equal(lifecycleMap.get('llm_action_logs').retention, '180d');
  assert.equal(lifecycleMap.get('llm_bandit_state').retention, 'INDEFINITE');
  assert.equal(lifecycleMap.get('llm_contextual_bandit_state').retention, 'INDEFINITE');

  assert.ok(addendum.includes('| `llm_action_logs` | event | 180d | CONDITIONAL | true |'));
  assert.ok(addendum.includes('| `llm_bandit_state` | aggregate | INDEFINITE | false | false |'));
  assert.ok(addendum.includes('| `llm_contextual_bandit_state` | aggregate | INDEFINITE | false | false |'));

  assert.ok(rules.includes('match /llm_action_logs/{docId}'));
  assert.ok(rules.includes('match /llm_bandit_state/{docId}'));
  assert.ok(rules.includes('match /llm_contextual_bandit_state/{docId}'));

  const dataModelOnly = (((allowlist || {}).allowlist || {}).data_model_only) || [];
  assert.equal(dataModelOnly.includes('llm_action_logs'), false);
  assert.equal(dataModelOnly.includes('llm_bandit_state'), false);
  assert.equal(dataModelOnly.includes('llm_contextual_bandit_state'), false);
});

test('phase717: llm retention contract script is wired and passes', () => {
  const pkg = readJson('package.json');
  assert.equal(pkg.scripts['llm:retention:check'], 'node scripts/check_llm_retention_contract.js');
  const output = childProcess.execSync('node scripts/check_llm_retention_contract.js', {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.ok(output.includes('[llm_retention_contract] ok'));
});
