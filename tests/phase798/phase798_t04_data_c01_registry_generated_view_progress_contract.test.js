'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

function readRegistry() {
  const file = path.join(__dirname, '..', '..', 'contracts', 'llm_spec_contract_registry.v2.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

test('phase798: DATA-C-01 registry evidence includes generated_view city pack sidecar progression', () => {
  const registry = readRegistry();
  const requirement = (registry.requirements || []).find((row) => row.requirementId === 'DATA-C-01');
  assert.ok(requirement, 'DATA-C-01 requirement must exist');
  const evidence = Array.isArray(requirement.evidence) ? requirement.evidence : [];
  assert.ok(evidence.some((row) => String(row).includes('src/repos/firestore/cityPacksRepo.js:1')));
  assert.ok(evidence.some((row) => String(row).includes('tests/phase798/phase798_t01_city_packs_generated_view_dual_write_contract.test.js:1')));
  assert.match(String(requirement.recommendedAction || ''), /generated_view|city_packs|typed/i);
});
