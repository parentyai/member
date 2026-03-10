'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

function readRegistry() {
  const file = path.join(__dirname, '..', '..', 'contracts', 'llm_spec_contract_registry.v2.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

test('phase795: DATA-C-01 recommended action includes source_evidence dual-write expansion', () => {
  const registry = readRegistry();
  const requirement = (registry.requirements || []).find((row) => row.requirementId === 'DATA-C-01');
  assert.ok(requirement, 'DATA-C-01 requirement must exist');
  assert.match(String(requirement.recommendedAction || ''), /source_evidence/i);
});

test('phase795: DATA-C-01 evidence includes sourceEvidenceRepo and phase795 contract test', () => {
  const registry = readRegistry();
  const requirement = (registry.requirements || []).find((row) => row.requirementId === 'DATA-C-01');
  assert.ok(requirement, 'DATA-C-01 requirement must exist');
  const evidence = Array.isArray(requirement.evidence) ? requirement.evidence : [];
  assert.ok(
    evidence.some((entry) => String(entry).includes('src/repos/firestore/sourceEvidenceRepo.js')),
    'DATA-C-01 evidence must include sourceEvidenceRepo path'
  );
  assert.ok(
    evidence.some((entry) => String(entry).includes('tests/phase795/phase795_t01_source_evidence_canonical_core_dual_write_contract.test.js')),
    'DATA-C-01 evidence must include source evidence dual-write contract test'
  );
});
