'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase760: parent YAML keeps routing/core fact/response contract invariants', () => {
  const yamlPath = path.join(ROOT, 'member_us_assignment_llm_contract_pack.yaml');
  const text = fs.readFileSync(yamlPath, 'utf8');
  assert.ok(text.includes('routing:'));
  assert.ok(text.includes('required_core_facts'));
  assert.ok(text.includes('response_contract'));
});
