'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase792: DATA-C-03 registry status is aligned with lifecycle evidence', () => {
  const registry = JSON.parse(fs.readFileSync('contracts/llm_spec_contract_registry.v2.json', 'utf8'));
  const row = registry.requirements.find((item) => item && item.requirementId === 'DATA-C-03');
  assert.ok(row, 'DATA-C-03 must exist');
  assert.equal(row.status, 'aligned');
  assert.match(String(row.recommendedAction || ''), /lifecycle state machine/i);
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  assert.ok(evidence.some((entry) => String(entry).includes('knowledgeLifecycleStateMachine.js')));
  assert.ok(evidence.some((entry) => String(entry).includes('faqArticlesRepo.js')));
});
