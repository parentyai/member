'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

function readRegistry() {
  const file = path.join(__dirname, '..', '..', 'contracts', 'llm_spec_contract_registry.v2.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

test('phase793: DATA-C-01 contract status is aligned for observable canonical core sidecars', () => {
  const registry = readRegistry();
  const requirement = (registry.requirements || []).find((row) => row.requirementId === 'DATA-C-01');
  assert.ok(requirement, 'DATA-C-01 requirement must exist');
  assert.equal(requirement.status, 'aligned');
  assert.match(
    String(requirement.recommendedAction || ''),
    /step_rules|city_packs|generated_view|exception_playbook/i,
    'DATA-C-01 action must mention current observable coverage and deferred scope'
  );
});

test('phase793: blocking conflict is cleared once observable sidecars are aligned', () => {
  const registry = readRegistry();
  const conflict = (registry.conflicts || []).find((row) => row.conflictId === 'CF-02');
  assert.equal(conflict, undefined);
});
