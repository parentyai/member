'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase790: contract registry marks YAML enum/routing and required_core_facts gates as aligned', () => {
  const registry = JSON.parse(fs.readFileSync('contracts/llm_spec_contract_registry.v2.json', 'utf8'));
  const yamlRouting = registry.requirements.find((row) => row && row.requirementId === 'YAML-C-01');
  const yamlCoreFacts = registry.requirements.find((row) => row && row.requirementId === 'YAML-C-02');
  assert.ok(yamlRouting, 'YAML-C-01 must exist');
  assert.ok(yamlCoreFacts, 'YAML-C-02 must exist');
  assert.equal(yamlRouting.status, 'aligned');
  assert.equal(yamlCoreFacts.status, 'aligned');
});
