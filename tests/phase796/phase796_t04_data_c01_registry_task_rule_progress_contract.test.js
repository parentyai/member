'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

function readRegistry() {
  const file = path.join(__dirname, '..', '..', 'contracts', 'llm_spec_contract_registry.v2.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

test('phase796: DATA-C-01 recommended action includes step_rules task/rule materialization progress', () => {
  const registry = readRegistry();
  const requirement = (registry.requirements || []).find((row) => row.requirementId === 'DATA-C-01');
  assert.ok(requirement, 'DATA-C-01 requirement must exist');
  assert.match(String(requirement.recommendedAction || ''), /step_rules/i);
  assert.match(String(requirement.recommendedAction || ''), /task_template/i);
  assert.match(String(requirement.recommendedAction || ''), /rule_set/i);
});

test('phase796: DATA-C-01 evidence includes stepRulesRepo and phase796 dual-write contract test', () => {
  const registry = readRegistry();
  const requirement = (registry.requirements || []).find((row) => row.requirementId === 'DATA-C-01');
  assert.ok(requirement, 'DATA-C-01 requirement must exist');
  const evidence = Array.isArray(requirement.evidence) ? requirement.evidence : [];
  assert.ok(
    evidence.some((entry) => String(entry).includes('src/repos/firestore/stepRulesRepo.js')),
    'DATA-C-01 evidence must include stepRulesRepo path'
  );
  assert.ok(
    evidence.some((entry) => String(entry).includes('tests/phase796/phase796_t02_step_rules_canonical_core_dual_write_contract.test.js')),
    'DATA-C-01 evidence must include step rule dual-write contract test'
  );
});
